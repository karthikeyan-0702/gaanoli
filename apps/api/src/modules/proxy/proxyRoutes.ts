import { Router, Request, Response } from 'express';
import youtubedl from 'youtube-dl-exec';
import { logger } from '../../middleware/logger.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import https from 'https';

export const proxyRouter = Router();

const ALLOWED_QUALITIES = new Set(['1080p', '720p', '480p', '360p']);

function resolveFormat(quality: unknown): string {
  const q = typeof quality === 'string' ? quality : '';
  if (!q || !ALLOWED_QUALITIES.has(q)) {
    return 'bestvideo[height<=720]+bestaudio/best';
  }
  if (q === '1080p') return 'bestvideo[height<=1080]+bestaudio/best';
  if (q === '720p') return 'bestvideo[height<=720]+bestaudio/best';
  if (q === '480p') return 'bestvideo[height<=480]+bestaudio/best';
  return 'bestvideo[height<=360]+bestaudio/best';
}

/**
 * Video Proxy — streams YouTube video through the GaanOli server.
 * The client never touches youtube.com directly.
 * Uses yt-dlp (via youtube-dl-exec) to mux and stream reliably.
 */
proxyRouter.get('/api/proxy/youtube/:videoId', authenticate, (req: Request, res: Response) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid video ID' }
    });
    return;
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const formatString = resolveFormat(req.query.quality);

  try {
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Accept-Ranges', 'none'); // yt-dlp stdout doesn't easily support range requests
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const ytdlProcess = youtubedl.exec(youtubeUrl, {
      output: '-',
      format: formatString,
      mergeOutputFormat: 'webm',
      jsRuntimes: 'node',
      noPlaylist: true,
      quiet: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android'
    } as Record<string, unknown>);
    
    // Catch the execa promise rejection to prevent Node server crashes
    ytdlProcess.catch((err) => {
      logger.error('YouTube proxy stream promise rejected', { videoId, error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'STREAM_FAILED', message: 'Stream process failed' } });
      }
    });

    if (ytdlProcess.stdout) {
      ytdlProcess.stdout.pipe(res);
    }

    ytdlProcess.on('error', (err: any) => {
      logger.error('YouTube proxy stream error (process)', { videoId, error: err.message });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_FAILED', message: 'Stream failed' }
        });
      } else {
        res.end();
      }
    });

    req.on('close', () => {
      if (ytdlProcess && !ytdlProcess.killed) {
        ytdlProcess.kill('SIGKILL');
      }
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (err: any) {
    logger.error('YouTube proxy failed to start', { videoId, error: err.message });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STREAM_FAILED',
          message: 'Could not start video stream.'
        }
      });
    }
  }
});

/**
 * Video Download — downloads YouTube video as a file through the GaanOli server.
 */
proxyRouter.get('/api/proxy/youtube/:videoId/download', authenticate, requireAdmin, (req: Request, res: Response) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid video ID' } });
    return;
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Default to 720p for downloads to balance quality and size, or use what's requested
  const quality =
    typeof req.query.quality === 'string' && ALLOWED_QUALITIES.has(req.query.quality)
      ? req.query.quality
      : '720p';
  const formatString = resolveFormat(quality);

  try {
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Disposition', `attachment; filename="video-${videoId}.webm"`);
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const ytdlProcess = youtubedl.exec(youtubeUrl, {
      output: '-',
      format: formatString,
      mergeOutputFormat: 'webm',
      jsRuntimes: 'node',
      noPlaylist: true,
      quiet: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android'
    } as Record<string, unknown>);
    
    ytdlProcess.catch((err) => {
      logger.error('YouTube download stream promise rejected', { videoId, error: err.message });
      if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'STREAM_FAILED', message: 'Stream process failed' } });
    });

    if (ytdlProcess.stdout) {
      ytdlProcess.stdout.pipe(res);
    }

    ytdlProcess.on('error', (err: any) => {
      logger.error('YouTube download stream error (process)', { videoId, error: err.message });
      if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'STREAM_FAILED', message: 'Stream failed' } });
      else res.end();
    });

    req.on('close', () => {
      if (ytdlProcess && !ytdlProcess.killed) ytdlProcess.kill('SIGKILL');
      if (!res.writableEnded) res.end();
    });
  } catch (err: any) {
    logger.error('YouTube download failed to start', { videoId, error: err.message });
    if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'STREAM_FAILED', message: 'Could not start download stream.' } });
  }
});

/**
 * Thumbnail — browser only sees your API host (no YouTube/Google URL in requests).
 */
proxyRouter.get('/api/proxy/youtube/:videoId/thumbnail', (req: Request, res: Response) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).end();
    return;
  }

  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  https
    .get(thumbUrl, (imageRes) => {
      if (imageRes.statusCode !== 200) {
        res.status(imageRes.statusCode || 502).end();
        return;
      }
      if (imageRes.headers['content-type']) {
        res.setHeader('Content-Type', imageRes.headers['content-type']);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('Referrer-Policy', 'no-referrer');
      imageRes.pipe(res);
    })
    .on('error', (err) => {
      logger.error('YouTube thumbnail proxy failed', { videoId, error: err.message });
      if (!res.headersSent) res.status(502).end();
    });
});

/**
 * Image Proxy — legacy fallback for stored external thumbnail URLs.
 */
proxyRouter.get('/api/proxy/image', (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;

  if (!imageUrl) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'URL is required' } });
    return;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const allowedDomains = [
      'img.youtube.com',
      'i.ytimg.com',
      'yt3.ggpht.com',
      'yt3.googleusercontent.com'
    ];

    // SSRF Protection
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      logger.warn('Blocked attempt to proxy unauthorized domain', { url: imageUrl });
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Domain not allowed for proxy' } });
      return;
    }

    https.get(imageUrl, (imageRes) => {
      if (imageRes.statusCode !== 200) {
        res.status(imageRes.statusCode || 500).end();
        return;
      }

      // Pass along the content type (e.g., image/jpeg) and caching headers
      if (imageRes.headers['content-type']) {
        res.setHeader('Content-Type', imageRes.headers['content-type']);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      imageRes.pipe(res);
    }).on('error', (err) => {
      logger.error('Image proxy failed', { url: imageUrl, error: err.message });
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (err: any) {
    logger.error('Invalid URL passed to image proxy', { url: imageUrl });
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid URL' } });
  }
});
