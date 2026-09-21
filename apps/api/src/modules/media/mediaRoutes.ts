import { Router } from 'express';
import fs from 'fs';
import { storageService } from '../../storage/index.js';
import { streamMediaFile } from './stream.js';
import { logger } from '../../middleware/logger.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';

export const mediaRouter = Router();

// HTTP 206 Range Stream for offline/local video playback
mediaRouter.get('/api/media/:id/stream', authenticate, requireAdmin, (req, res) => {
  const mediaId = req.params.id;
  try {
    const filePath = storageService.getAbsolutePath(`media/${mediaId}.mp4`);
    streamMediaFile(filePath, req, res, 'video/mp4');
  } catch (err) {
    logger.warn('Media streaming error', { mediaId, error: err instanceof Error ? err.message : err });
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Media stream not found' } });
  }
});

// Generated thumbnail image endpoint
mediaRouter.get('/api/media/:id/thumbnail', authenticate, requireAdmin, (req, res) => {
  const mediaId = req.params.id;
  try {
    const filePath = storageService.getAbsolutePath(`thumbnails/${mediaId}.jpg`);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('Thumbnail not found');
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(404).send('Thumbnail not found');
  }
});

// Real storage statistics
mediaRouter.get('/api/storage/stats', authenticate, async (_req, res, next) => {
  try {
    const stats = await storageService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});
