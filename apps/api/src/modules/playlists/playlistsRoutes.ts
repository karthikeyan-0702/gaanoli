import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { CreatePlaylistSchema, Playlist, PlaylistItem } from '@gatube/shared';

export const playlistsRouter = Router();

playlistsRouter.get('/api/playlists', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const dbRes = await query(
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

    const playlists: Playlist[] = dbRes.rows.map((row) => ({
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

    res.json({ success: true, data: playlists });
  } catch (err) {
    next(err);
  }
});

playlistsRouter.post('/api/playlists', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const body = CreatePlaylistSchema.parse(req.body);

    const dbRes = await query(
      `INSERT INTO playlists (user_id, name, description, is_private)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, body.name, body.description, body.isPrivate]
    );

    const row = dbRes.rows[0];
    const playlist: Playlist = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isPrivate: row.is_private,
      videoCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.status(201).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
});

playlistsRouter.get('/api/playlists/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const playlistId = req.params.id as string;

    const plRes = await query(
      `SELECT * FROM playlists WHERE id = $1 AND user_id = $2`,
      [playlistId, userId]
    );

    if (plRes.rowCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
      return;
    }

    const itemsRes = await query(
      `SELECT pi.id AS item_id, pi.position, pi.added_at,
              v.*
       FROM playlist_items pi
       INNER JOIN videos v ON v.id = pi.video_id
       WHERE pi.playlist_id = $1
       ORDER BY pi.position ASC`,
      [playlistId]
    );

    const items: PlaylistItem[] = itemsRes.rows.map((row) => ({
      id: row.item_id,
      playlistId,
      videoId: row.id,
      position: row.position,
      addedAt: row.added_at,
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

    const pl = plRes.rows[0];
    res.json({
      success: true,
      data: {
        id: pl.id,
        name: pl.name,
        description: pl.description,
        isPrivate: pl.is_private,
        videoCount: items.length,
        items
      }
    });
  } catch (err) {
    next(err);
  }
});

playlistsRouter.post('/api/playlists/:id/items', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const playlistId = req.params.id;
    const { videoId } = req.body;

    if (!videoId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'videoId is required' } });
      return;
    }

    const playlistRes = await query(
      `SELECT id FROM playlists WHERE id = $1 AND user_id = $2`,
      [playlistId, userId]
    );
    if (playlistRes.rowCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
      return;
    }

    // Get max position
    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM playlist_items WHERE playlist_id = $1`,
      [playlistId]
    );
    const nextPos = posRes.rows[0].next_pos;

    await query(
      `INSERT INTO playlist_items (playlist_id, video_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, video_id) DO NOTHING`,
      [playlistId, videoId, nextPos]
    );

    res.status(201).json({ success: true, data: { added: true } });
  } catch (err) {
    next(err);
  }
});

playlistsRouter.delete('/api/playlists/:id/items/:videoId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const playlistId = req.params.id;
    const videoId = req.params.videoId;

    const playlistRes = await query(
      `SELECT id FROM playlists WHERE id = $1 AND user_id = $2`,
      [playlistId, userId]
    );
    if (playlistRes.rowCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
      return;
    }

    await query(
      `DELETE FROM playlist_items WHERE playlist_id = $1 AND video_id = $2`,
      [playlistId, videoId]
    );

    res.json({ success: true, data: { removed: true } });
  } catch (err) {
    next(err);
  }
});

playlistsRouter.delete('/api/playlists/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const playlistId = req.params.id;

    await query(`DELETE FROM playlists WHERE id = $1 AND user_id = $2`, [playlistId, userId]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
