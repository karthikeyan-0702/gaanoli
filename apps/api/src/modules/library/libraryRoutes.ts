import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { Video, Playlist } from '@gatube/shared';

export const libraryRouter = Router();

libraryRouter.get('/api/library', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // 1. Favorites
    const favRes = await query(
      `SELECT v.*
       FROM videos v
       INNER JOIN favorites f ON f.video_id = v.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    // 2. Downloaded Media
    const dlRes = await query(
      `SELECT v.*
       FROM videos v
       WHERE v.is_downloaded = TRUE
       ORDER BY v.updated_at DESC`,
      []
    );

    // 3. Recently Watched
    const histRes = await query(
      `SELECT v.*, wh.last_position_seconds, wh.progress_percent, wh.last_watched_at
       FROM watch_history wh
       INNER JOIN videos v ON v.id = wh.video_id
       WHERE wh.user_id = $1
       ORDER BY wh.last_watched_at DESC
       LIMIT 10`,
      [userId]
    );

    // 4. Playlists
    const plRes = await query(
      `SELECT p.*,
              COUNT(pi.id)::int AS video_count,
              (SELECT v.thumbnail_url
               FROM playlist_items pi2
               INNER JOIN videos v ON v.id = pi2.video_id
               WHERE pi2.playlist_id = p.id
               ORDER BY pi2.position ASC LIMIT 1) AS thumbnail_url
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const mapVideo = (row: any): Video => ({
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
    });

    const playlists: Playlist[] = plRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      videoCount: row.video_count,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      data: {
        favorites: favRes.rows.map(mapVideo),
        downloads: dlRes.rows.map(mapVideo),
        history: histRes.rows.map((r) => ({
          ...mapVideo(r),
          lastPositionSeconds: r.last_position_seconds,
          progressPercent: r.progress_percent,
          lastWatchedAt: r.last_watched_at
        })),
        playlists
      }
    });
  } catch (err) {
    next(err);
  }
});
