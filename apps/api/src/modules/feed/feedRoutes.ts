import { Router } from 'express';
import { query } from '../../database/index.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { Video } from '@gatube/shared';

export const feedRouter = Router();

/**
 * Personalized feed:
 * 1. Videos matching recent search terms (weighted by recency)
 * 2. Recently added videos the user hasn't watched
 * 3. Continue watching (in-progress videos)
 * 4. All remaining videos ordered by recency
 */
feedRouter.get('/api/feed', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // 1. Get recent search terms (last 20 unique queries)
    const searchRes = await query(
      `SELECT DISTINCT ON (LOWER(query)) query
       FROM search_history
       WHERE user_id = $1
       ORDER BY LOWER(query), created_at DESC
       LIMIT 20`,
      [userId]
    );

    const searchTerms = searchRes.rows.map((r) => r.query);

    // 2. Build personalized feed
    let feedVideos: Video[] = [];
    const seenIds = new Set<string>();

    // Phase A: Videos matching search history (most relevant)
    if (searchTerms.length > 0) {
      const likeConditions = searchTerms
        .map((_, i) => `(title ILIKE $${i + 1} OR channel_title ILIKE $${i + 1} OR description ILIKE $${i + 1})`)
        .join(' OR ');
      const likeParams = searchTerms.map((t) => `%${t}%`);

      const matchRes = await query(
        `SELECT * FROM videos
         WHERE (${likeConditions})
         ORDER BY created_at DESC
         LIMIT 30`,
        likeParams
      );

      for (const row of matchRes.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          feedVideos.push(mapVideo(row));
        }
      }
    }

    // Phase B: Continue watching (in-progress)
    const continueRes = await query(
      `SELECT v.*
       FROM watch_history wh
       INNER JOIN videos v ON v.id = wh.video_id
       WHERE wh.user_id = $1 AND wh.is_completed = FALSE AND wh.progress_percent > 5
       ORDER BY wh.last_watched_at DESC
       LIMIT 10`,
      [userId]
    );

    for (const row of continueRes.rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        feedVideos.push(mapVideo(row));
      }
    }

    // Phase C: All remaining videos ordered by newest first
    const allRes = await query(
      `SELECT * FROM videos
       ORDER BY created_at DESC
       LIMIT 50`
    );

    for (const row of allRes.rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        feedVideos.push(mapVideo(row));
      }
    }

    res.json({ success: true, data: feedVideos });
  } catch (err) {
    next(err);
  }
});

function mapVideo(row: any): Video {
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
