import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { CreateNoteSchema, VideoNote } from '@gatube/shared';

export const notesRouter = Router();

notesRouter.get('/api/notes/:videoId', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const videoId = req.params.videoId;

    const dbRes = await query(
      `SELECT * FROM notes
       WHERE user_id = $1 AND video_id = $2
       ORDER BY timestamp_seconds ASC NULLS LAST, created_at ASC`,
      [userId, videoId]
    );

    const notes: VideoNote[] = dbRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      videoId: row.video_id,
      timestampSeconds: row.timestamp_seconds,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
});

notesRouter.post('/api/notes', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const body = CreateNoteSchema.parse(req.body);

    const dbRes = await query(
      `INSERT INTO notes (user_id, video_id, timestamp_seconds, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, body.videoId, body.timestampSeconds !== undefined ? body.timestampSeconds : null, body.content]
    );

    const row = dbRes.rows[0];
    const note: VideoNote = {
      id: row.id,
      userId: row.user_id,
      videoId: row.video_id,
      timestampSeconds: row.timestamp_seconds,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

notesRouter.delete('/api/notes/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const noteId = req.params.id;

    await query(`DELETE FROM notes WHERE id = $1 AND user_id = $2`, [noteId, userId]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
