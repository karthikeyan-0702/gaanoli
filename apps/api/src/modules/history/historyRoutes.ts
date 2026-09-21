import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { UpdateHistorySchema, WatchHistoryItem } from '@gatube/shared';

export const historyRouter = Router();

historyRouter.get('/api/history', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const dbRes = await query(
      `SELECT wh.id AS history_id, wh.last_position_seconds, wh.duration_seconds AS wh_duration,
              wh.progress_percent, wh.is_completed, wh.last_watched_at,
              v.*
       FROM watch_history wh
       INNER JOIN videos v ON v.id = wh.video_id
       WHERE wh.user_id = $1
       ORDER BY wh.last_watched_at DESC
       LIMIT 50`,
      [userId]
    );

    const items: WatchHistoryItem[] = dbRes.rows.map((row) => ({
      id: row.history_id,
      userId,
      videoId: row.id,
      lastPositionSeconds: row.last_position_seconds,
      durationSeconds: row.wh_duration,
      progressPercent: row.progress_percent,
      isCompleted: row.is_completed,
      lastWatchedAt: row.last_watched_at,
      video: {
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
      }
    }));

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

historyRouter.post('/api/history', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const body = UpdateHistorySchema.parse(req.body);

    const duration = body.durationSeconds || 0;
    const progressPercent =
      duration > 0
        ? Math.min(100, Math.round((body.positionSeconds / duration) * 100))
        : 0;
    const isCompleted = progressPercent >= 90;

    await query(
      `INSERT INTO watch_history (
         user_id, video_id, last_position_seconds, duration_seconds, progress_percent, is_completed, last_watched_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, video_id)
       DO UPDATE SET
         last_position_seconds = EXCLUDED.last_position_seconds,
         duration_seconds = EXCLUDED.duration_seconds,
         progress_percent = EXCLUDED.progress_percent,
         is_completed = EXCLUDED.is_completed,
         last_watched_at = NOW()`,
      [userId, body.videoId, Math.round(body.positionSeconds), Math.round(duration), progressPercent, isCompleted]
    );

    res.json({ success: true, data: { progressPercent, isCompleted } });
  } catch (err) {
    next(err);
  }
});

historyRouter.delete('/api/history/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const historyId = req.params.id;

    await query(`DELETE FROM watch_history WHERE id = $1 AND user_id = $2`, [historyId, userId]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

historyRouter.delete('/api/history', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    await query(`DELETE FROM watch_history WHERE user_id = $1`, [userId]);
    res.json({ success: true, data: { cleared: true } });
  } catch (err) {
    next(err);
  }
});
