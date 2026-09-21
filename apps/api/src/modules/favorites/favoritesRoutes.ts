import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { Video } from '@gatube/shared';

export const favoritesRouter = Router();

favoritesRouter.get('/api/favorites', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const dbRes = await query(
      `SELECT v.*
       FROM videos v
       INNER JOIN favorites f ON f.video_id = v.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    const videos: Video[] = dbRes.rows.map((row) => ({
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

    res.json({ success: true, data: videos });
  } catch (err) {
    next(err);
  }
});

favoritesRouter.post('/api/favorites/:videoId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const videoId = req.params.videoId;

    await query(
      `INSERT INTO favorites (user_id, video_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, video_id) DO NOTHING`,
      [userId, videoId]
    );

    res.json({ success: true, data: { isFavorite: true } });
  } catch (err) {
    next(err);
  }
});

favoritesRouter.delete('/api/favorites/:videoId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const videoId = req.params.videoId;

    await query(
      `DELETE FROM favorites WHERE user_id = $1 AND video_id = $2`,
      [userId, videoId]
    );

    res.json({ success: true, data: { isFavorite: false } });
  } catch (err) {
    next(err);
  }
});
