import { Router, Response } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { mediaQueue } from '../pipeline/queue.js';
import { eventBroadcaster } from '../pipeline/events.js';
import { storageService } from '../../storage/index.js';
import { DownloadJob } from '@gatube/shared';

export const downloadsRouter = Router();

// Server-Sent Events stream for live progress updates
downloadsRouter.get('/api/downloads/events', authenticate, (req, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const cleanup = eventBroadcaster.registerClient(res);
  req.on('close', cleanup);
});

// List all download jobs (active & completed)
downloadsRouter.get('/api/downloads', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const dbRes = await query(
      `SELECT dj.*,
              v.title AS video_title, v.channel_title, v.thumbnail_url, v.duration_seconds, v.playback_url
       FROM download_jobs dj
       INNER JOIN videos v ON v.id = dj.video_id
       WHERE dj.user_id = $1
       ORDER BY dj.created_at DESC`,
      [userId]
    );

    const activeJobs: DownloadJob[] = [];
    const completedJobs: DownloadJob[] = [];

    for (const row of dbRes.rows) {
      const job: DownloadJob = {
        id: row.id,
        userId: row.user_id,
        videoId: row.video_id,
        status: row.status,
        progressPercent: row.progress_percent,
        downloadedBytes: Number(row.downloaded_bytes),
        totalBytes: Number(row.total_bytes),
        speedBytesPerSec: Number(row.speed_bytes_per_sec),
        etaSeconds: row.eta_seconds,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
        video: {
          id: row.video_id,
          source: 'authorized_source',
          sourceId: '',
          title: row.video_title,
          channelTitle: row.channel_title,
          description: '',
          thumbnailUrl: row.thumbnail_url,
          durationSeconds: row.duration_seconds,
          isDownloadable: true,
          isDownloaded: row.status === 'COMPLETED',
          playbackUrl: row.playback_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      };

      if (['PENDING', 'QUEUED', 'DOWNLOADING', 'PROCESSING'].includes(job.status)) {
        activeJobs.push(job);
      } else {
        completedJobs.push(job);
      }
    }

    res.json({
      success: true,
      data: {
        active: activeJobs,
        completed: completedJobs
      }
    });
  } catch (err) {
    next(err);
  }
});

// Trigger download for an authorized video
downloadsRouter.post('/api/downloads', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { videoId } = req.body;

    if (!videoId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'videoId is required' } });
      return;
    }

    // Verify video
    const videoRes = await query(`SELECT * FROM videos WHERE id = $1`, [videoId]);
    if (videoRes.rowCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } });
      return;
    }

    const video = videoRes.rows[0];

    // Policy check: Only authorized media can be downloaded
    if (!video.is_downloadable || video.source === 'youtube') {
      res.status(403).json({
        success: false,
        error: {
          code: 'DOWNLOAD_UNAUTHORIZED',
          message: 'This source does not provide an authorized download option. YouTube content is streamed via official embedded playback.'
        }
      });
      return;
    }

    const mediaUrl = video.playback_url?.trim();
    if (!mediaUrl) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'This video does not have a downloadable media URL.' }
      });
      return;
    }

    // Check if already downloaded
    if (video.is_downloaded) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'This video is already downloaded in your offline library.' }
      });
      return;
    }

    // Create download job record
    const jobRes = await query(
      `INSERT INTO download_jobs (user_id, video_id, status)
       VALUES ($1, $2, 'QUEUED')
       RETURNING *`,
      [userId, videoId]
    );

    const job = jobRes.rows[0];

    // Dispatch to BullMQ Queue
    await mediaQueue.add(
      'process-download',
      {
        jobId: job.id,
        userId,
        videoId,
        mediaUrl,
        title: video.title
      },
      { jobId: job.id }
    );

    eventBroadcaster.broadcast({
      type: 'download.started',
      jobId: job.id,
      videoId,
      data: { title: video.title, status: 'QUEUED' }
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'QUEUED',
        message: 'Download job queued in media pipeline'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Cancel active download
downloadsRouter.post('/api/downloads/:id/cancel', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id as string;

    // Remove from BullMQ
    const bullJob = await mediaQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }

    await query(
      `UPDATE download_jobs
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    res.json({ success: true, data: { status: 'CANCELLED' } });
  } catch (err) {
    next(err);
  }
});

// Delete completed download
downloadsRouter.delete('/api/downloads/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id as string;

    const jobRes = await query(`SELECT * FROM download_jobs WHERE id = $1 AND user_id = $2`, [jobId, userId]);
    if (jobRes.rowCount && jobRes.rowCount > 0) {
      const videoId = jobRes.rows[0].video_id;

      // Delete file from disk
      const mediaFile = `media/${jobId}.mp4`;
      const thumbFile = `thumbnails/${jobId}.jpg`;
      await storageService.deleteFile(mediaFile).catch(() => {});
      await storageService.deleteFile(thumbFile).catch(() => {});

      // Delete media_files and download_jobs records
      await query(`DELETE FROM media_files WHERE id = $1`, [jobId]);
      await query(`DELETE FROM download_jobs WHERE id = $1`, [jobId]);
      await query(`UPDATE videos SET is_downloaded = FALSE, playback_url = NULL WHERE id = $1`, [videoId]);
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
