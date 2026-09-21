import { Router } from 'express';
import { videosService } from './videosService.js';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../middleware/auth.js';
import { ImportUrlSchema, SearchQuerySchema } from '@gatube/shared';

export const videosRouter = Router();

videosRouter.get('/api/search', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const queryDto = SearchQuerySchema.parse({
      query: req.query.query || req.query.q || '',
      source: req.query.source || 'all',
      limit: req.query.limit || 20
    });

    // Record search term for personalized feed
    if (queryDto.query.trim()) {
      query(
        `INSERT INTO search_history (user_id, query) VALUES ($1, $2)`,
        [req.user!.id, queryDto.query.trim()]
      ).catch(() => {}); // fire-and-forget
    }

    const videos = await videosService.searchVideos(queryDto.query, queryDto.source, queryDto.limit);
    res.json({ success: true, data: videos });
  } catch (err) {
    next(err);
  }
});

videosRouter.get('/api/videos/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const video = await videosService.getVideoById(req.params.id as string, req.user!.id);
    if (!video) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } });
      return;
    }
    res.json({ success: true, data: video });
  } catch (err) {
    next(err);
  }
});

videosRouter.post('/api/videos/import', authenticate, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = ImportUrlSchema.parse(req.body);
    const video = await videosService.importVideoUrl(body.url);
    res.status(201).json({ success: true, data: video });
  } catch (err) {
    next(err);
  }
});
