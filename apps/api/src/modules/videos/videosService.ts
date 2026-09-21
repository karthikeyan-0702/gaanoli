import { Video, VideoWithUserData } from '@gatube/shared';
import { query } from '../../database/index.js';
import { sourceRegistry } from '../sources/sourceRegistry.js';
import { config } from '../../config/index.js';
import { logger } from '../../middleware/logger.js';
import { youtubeThumbnailApiPath } from '../../lib/clientPrivacy.js';

export class VideosService {
  private async refreshYoutubeMetadata(
    videoId: string,
    currentDescription: string,
    currentDuration: number
  ): Promise<{ description: string; durationSeconds: number } | null> {
    if (!config.YOUTUBE_API_KEY || (currentDescription && !currentDescription.trim().endsWith('...')) && currentDuration > 0) {
      return null;
    }

    try {
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${config.YOUTUBE_API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) return null;

      const detailsData = (await detailsRes.json()) as any;
      const item = detailsData.items?.[0];
      if (!item) return null;

      const description = item.snippet?.description || currentDescription;
      const isoDuration = item.contentDetails?.duration || '';
      const durationMatch = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const durationSeconds = durationMatch
        ? parseInt(durationMatch[1] || '0', 10) * 3600 +
          parseInt(durationMatch[2] || '0', 10) * 60 +
          parseInt(durationMatch[3] || '0', 10)
        : currentDuration;

      return { description, durationSeconds };
    } catch (error) {
      logger.warn('YouTube detail refresh failed', { videoId, error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  async getVideoById(videoId: string, userId: string): Promise<VideoWithUserData | null> {
    const res = await query(
      `SELECT v.*,
              (f.id IS NOT NULL) AS is_favorite,
              COALESCE(wh.last_position_seconds, 0) AS last_position_seconds,
              COALESCE(wh.progress_percent, 0) AS watch_progress_percent,
              (SELECT COUNT(*) FROM notes n WHERE n.video_id = v.id AND n.user_id = $2) AS notes_count
       FROM videos v
       LEFT JOIN favorites f ON f.video_id = v.id AND f.user_id = $2
       LEFT JOIN watch_history wh ON wh.video_id = v.id AND wh.user_id = $2
       WHERE v.id = $1`,
      [videoId, userId]
    );

    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    if (row.source === 'youtube') {
      const refreshed = await this.refreshYoutubeMetadata(
        row.source_id,
        row.description || '',
        Number(row.duration_seconds) || 0
      );
      if (refreshed) {
        row.description = refreshed.description;
        row.duration_seconds = refreshed.durationSeconds;
        await query(
          `UPDATE videos
           SET description = $1, duration_seconds = $2, updated_at = NOW()
           WHERE id = $3`,
          [refreshed.description, refreshed.durationSeconds, videoId]
        );
      }
    }

    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      title: row.title,
      channelTitle: row.channel_title,
      description: row.description,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      isDownloadable: row.is_downloadable,
      isDownloaded: row.is_downloaded,
      playbackUrl: row.playback_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isFavorite: Boolean(row.is_favorite),
      lastPositionSeconds: row.last_position_seconds,
      watchProgressPercent: row.watch_progress_percent,
      notesCount: parseInt(row.notes_count, 10)
    };
  }

  async importVideoUrl(url: string): Promise<Video> {
    const meta = await sourceRegistry.resolve(url);

    const res = await query(
      `INSERT INTO videos (
         source, source_id, title, channel_title, description,
         thumbnail_url, duration_seconds, is_downloadable, is_downloaded, playback_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (source, source_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         channel_title = EXCLUDED.channel_title,
         description = CASE WHEN videos.description = '' THEN EXCLUDED.description ELSE videos.description END,
         thumbnail_url = CASE WHEN videos.thumbnail_url = '' THEN EXCLUDED.thumbnail_url ELSE videos.thumbnail_url END,
         updated_at = NOW()
       RETURNING *`,
      [
        meta.source,
        meta.sourceId,
        meta.title,
        meta.channelTitle,
        meta.description,
        meta.thumbnailUrl,
        meta.durationSeconds,
        meta.isDownloadable,
        false,
        meta.directMediaUrl || null
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      title: row.title,
      channelTitle: row.channel_title,
      description: row.description,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      isDownloadable: row.is_downloadable,
      isDownloaded: row.is_downloaded,
      playbackUrl: row.playback_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async searchVideos(searchTerm: string, source = 'all', limit = 20): Promise<Video[]> {
    let sql = `SELECT * FROM videos WHERE 1=1`;
    const params: any[] = [];

    if (searchTerm.trim()) {
      params.push(`%${searchTerm.trim()}%`);
      sql += ` AND (title ILIKE $${params.length} OR channel_title ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    const sourceFilter =
      source === 'local' ? 'authorized_source' : source;

    if (sourceFilter !== 'all') {
      params.push(sourceFilter);
      sql += ` AND source = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await query(sql, params);

    const localVideos: Video[] = res.rows.map((row) => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      title: row.title,
      channelTitle: row.channel_title,
      description: row.description,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      isDownloadable: row.is_downloadable,
      isDownloaded: row.is_downloaded,
      playbackUrl: row.playback_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    // If official YouTube API key is available, query YouTube search API and append non-duplicate results
    if (config.YOUTUBE_API_KEY && searchTerm.trim() && (source === 'all' || source === 'youtube')) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          searchTerm
        )}&type=video&maxResults=50&key=${config.YOUTUBE_API_KEY}`;
        const ytRes = await fetch(url);
        if (ytRes.ok) {
          const ytData = (await ytRes.json()) as any;
          logger.info('YouTube Search API succeeded', { resultCount: ytData.items?.length });
          const existingIds = new Set(localVideos.map((v) => v.sourceId));

          const resultIds = (ytData.items || [])
            .map((item: any) => item.id?.videoId)
            .filter((id: unknown): id is string => typeof id === 'string' && !existingIds.has(id));
          const detailsById = new Map<string, { description?: string; durationSeconds?: number }>();

          if (resultIds.length > 0) {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${resultIds
              .slice(0, 50)
              .join(',')}&key=${config.YOUTUBE_API_KEY}`;
            const detailsRes = await fetch(detailsUrl);
            if (detailsRes.ok) {
              const detailsData = (await detailsRes.json()) as any;
              for (const item of detailsData.items || []) {
                const isoDuration = item.contentDetails?.duration || '';
                const durationMatch = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                const hours = parseInt(durationMatch?.[1] || '0', 10);
                const minutes = parseInt(durationMatch?.[2] || '0', 10);
                const seconds = parseInt(durationMatch?.[3] || '0', 10);
                detailsById.set(item.id, {
                  description: item.snippet?.description,
                  durationSeconds: durationMatch ? hours * 3600 + minutes * 60 + seconds : 0
                });
              }
            }
          }

          const importPromises = [];
          for (const item of ytData.items || []) {
            const vidId = item.id?.videoId;
            if (!vidId || existingIds.has(vidId)) continue;
            
            const snippet = item.snippet;
            if (!snippet) continue;

            const title = snippet.title || 'Unknown Title';
            const channelTitle = snippet.channelTitle || 'Unknown Channel';
            const details = detailsById.get(vidId);
            const description = details?.description || snippet.description || '';
            const thumbnailUrl = youtubeThumbnailApiPath(vidId);

            const durationSeconds = details?.durationSeconds || 0;

            // Insert into DB directly
            importPromises.push(
              query(
                `INSERT INTO videos (
                  source, source_id, title, channel_title, description,
                  thumbnail_url, duration_seconds, is_downloadable, is_downloaded
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (source, source_id)
                DO UPDATE SET
                  title = EXCLUDED.title,
                  channel_title = EXCLUDED.channel_title,
                  description = CASE
                    WHEN videos.source = 'youtube' AND length(EXCLUDED.description) > length(videos.description)
                    THEN EXCLUDED.description
                    ELSE videos.description
                  END,
                  duration_seconds = CASE
                    WHEN EXCLUDED.duration_seconds > videos.duration_seconds THEN EXCLUDED.duration_seconds
                    ELSE videos.duration_seconds
                  END,
                  thumbnail_url = CASE WHEN videos.thumbnail_url = '' THEN EXCLUDED.thumbnail_url ELSE videos.thumbnail_url END,
                  updated_at = NOW()
                RETURNING *`,
                ['youtube', vidId, title, channelTitle, description, thumbnailUrl, durationSeconds, false, false]
              ).then(res => {
                const row = res.rows[0];
                return {
                  id: row.id,
                  source: row.source as any,
                  sourceId: row.source_id,
                  title: row.title,
                  channelTitle: row.channel_title,
                  description: row.description,
                  thumbnailUrl: row.thumbnail_url,
                  durationSeconds: row.duration_seconds,
                  isDownloadable: row.is_downloadable,
                  isDownloaded: row.is_downloaded,
                  playbackUrl: row.playback_url,
                  createdAt: row.created_at,
                  updatedAt: row.updated_at
                };
              }).catch((e) => {
                logger.error('Failed to save search result video', { vidId, error: e.message });
                return null;
              })
            );
          }

          // Await all imports in parallel for massive speedup
          const savedVideos = await Promise.all(importPromises);
          for (const saved of savedVideos) {
            if (saved) localVideos.push(saved);
          }
        } else {
          logger.warn('YouTube Search API returned non-OK status', { status: ytRes.status, statusText: ytRes.statusText });
        }
      } catch (err) {
        logger.warn('YouTube Search API query failed', { error: err instanceof Error ? err.message : err });
      }
    }

    return localVideos;
  }
}

export const videosService = new VideosService();
