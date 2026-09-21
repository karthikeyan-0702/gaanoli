import { Worker, Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { redisClient } from '../../queues/redis.js';
import { query } from '../../database/index.js';
import { storageService } from '../../storage/index.js';
import { probeMedia, generateThumbnail } from '../media/ffmpeg.js';
import { eventBroadcaster } from './events.js';
import { MEDIA_QUEUE_NAME, MediaDownloadJobData } from './queue.js';
import { logger } from '../../middleware/logger.js';
import { fetchSafeRemoteMedia } from '../../lib/remoteUrl.js';
import { config } from '../../config/index.js';

export function initMediaWorker(): Worker<MediaDownloadJobData> {
  const worker = new Worker<MediaDownloadJobData>(
    MEDIA_QUEUE_NAME,
    async (job: Job<MediaDownloadJobData>) => {
      const { jobId, videoId, mediaUrl, title } = job.data;
      logger.info('Starting media pipeline processing', { jobId, videoId, title });

      const startTime = Date.now();

      try {
        // 1. Mark status DOWNLOADING
        await query(
          `UPDATE download_jobs
           SET status = 'DOWNLOADING', started_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [jobId]
        );

        eventBroadcaster.broadcast({
          type: 'download.started',
          jobId,
          videoId,
          data: { title, status: 'DOWNLOADING' }
        });

        // 2. Download remote authorized stream
        const response = await fetchSafeRemoteMedia(mediaUrl);
        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch media stream: ${response.status} ${response.statusText}`);
        }

        const totalBytesHeader = response.headers.get('content-length');
        const totalBytes = totalBytesHeader ? parseInt(totalBytesHeader, 10) : 0;
        if (totalBytes > config.MAX_UPLOAD_SIZE_BYTES) {
          throw new Error(`Media exceeds the ${config.MAX_UPLOAD_SIZE_BYTES} byte limit`);
        }

        const mediaFilename = `media/${jobId}.mp4`;
        const localFilePath = storageService.getAbsolutePath(mediaFilename);
        const dir = path.dirname(localFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const fileWriteStream = fs.createWriteStream(localFilePath);

        let downloadedBytes = 0;
        let lastProgressUpdate = Date.now();
        let lastDownloadedBytes = 0;

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fileWriteStream.write(Buffer.from(value));
          downloadedBytes += value.length;
          if (downloadedBytes > config.MAX_UPLOAD_SIZE_BYTES) {
            await reader.cancel();
            throw new Error(`Media exceeds the ${config.MAX_UPLOAD_SIZE_BYTES} byte limit`);
          }

          // Throttle progress updates to at most once every 500ms
          const now = Date.now();
          if (now - lastProgressUpdate > 500) {
            const timeDelta = (now - lastProgressUpdate) / 1000;
            const bytesDelta = downloadedBytes - lastDownloadedBytes;
            const speedBytesPerSec = Math.round(bytesDelta / timeDelta);

            const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
            const etaSeconds = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
            const progressPercent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50;

            await query(
              `UPDATE download_jobs
               SET progress_percent = $1, downloaded_bytes = $2, total_bytes = $3,
                   speed_bytes_per_sec = $4, eta_seconds = $5, updated_at = NOW()
               WHERE id = $6`,
              [progressPercent, downloadedBytes, totalBytes, speedBytesPerSec, etaSeconds, jobId]
            );

            eventBroadcaster.broadcast({
              type: 'download.progress',
              jobId,
              videoId,
              data: {
                progressPercent,
                downloadedBytes,
                totalBytes,
                speedBytesPerSec,
                etaSeconds
              }
            });

            lastProgressUpdate = now;
            lastDownloadedBytes = downloadedBytes;
          }
        }

        await new Promise<void>((resolve, reject) => {
          fileWriteStream.end();
          fileWriteStream.on('finish', () => resolve());
          fileWriteStream.on('error', reject);
        });

        // 3. Mark status PROCESSING
        await query(
          `UPDATE download_jobs
           SET status = 'PROCESSING', progress_percent = 99, updated_at = NOW()
           WHERE id = $1`,
          [jobId]
        );

        eventBroadcaster.broadcast({
          type: 'download.processing',
          jobId,
          videoId,
          data: { status: 'PROCESSING' }
        });

        // 4. Run FFmpeg Metadata Extraction & Thumbnail Generation
        const probe = await probeMedia(localFilePath);
        const thumbnailFilename = `thumbnails/${jobId}.jpg`;
        const thumbnailPath = storageService.getAbsolutePath(thumbnailFilename);
        await generateThumbnail(localFilePath, thumbnailPath);

        const playbackUrl = `/api/media/${jobId}/stream`;
        const thumbnailUrl = fs.existsSync(thumbnailPath) ? `/api/media/${jobId}/thumbnail` : '';

        // 5. Store media file record in PostgreSQL
        await query(
          `INSERT INTO media_files (id, video_id, file_path, file_size_bytes, mime_type, format, resolution)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            jobId,
            videoId,
            mediaFilename,
            downloadedBytes,
            'video/mp4',
            probe.formatName,
            probe.width && probe.height ? `${probe.width}x${probe.height}` : '1080p'
          ]
        );

        // 6. Update video with playback URL, duration, and downloaded flag
        await query(
          `UPDATE videos
           SET is_downloaded = TRUE,
               playback_url = $1,
               thumbnail_url = COALESCE(NULLIF($2, ''), thumbnail_url),
               duration_seconds = CASE WHEN duration_seconds = 0 THEN $3 ELSE duration_seconds END,
               updated_at = NOW()
           WHERE id = $4`,
          [playbackUrl, thumbnailUrl, probe.durationSeconds, videoId]
        );

        // 7. Complete job
        await query(
          `UPDATE download_jobs
           SET status = 'COMPLETED', progress_percent = 100,
               downloaded_bytes = $1, total_bytes = $1,
               speed_bytes_per_sec = 0, eta_seconds = 0,
               completed_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [downloadedBytes, jobId]
        );

        eventBroadcaster.broadcast({
          type: 'download.completed',
          jobId,
          videoId,
          data: {
            status: 'COMPLETED',
            durationMs: Date.now() - startTime,
            playbackUrl
          }
        });

        logger.info('✓ Media pipeline successfully processed job', { jobId, videoId });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Processing failed';
        logger.error('❌ Media pipeline job failed', error, { jobId, videoId });

        await query(
          `UPDATE download_jobs
           SET status = 'FAILED', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [errorMsg, jobId]
        );

        eventBroadcaster.broadcast({
          type: 'download.failed',
          jobId,
          videoId,
          data: { status: 'FAILED', error: errorMsg }
        });

        throw error;
      }
    },
    {
      connection: redisClient as any,
      concurrency: 2
    }
  );

  worker.on('error', (err: any) => {
    // Suppress all background worker connection errors. 
    // They are non-fatal and just mean background downloads won't work.
  });

  return worker;
}
