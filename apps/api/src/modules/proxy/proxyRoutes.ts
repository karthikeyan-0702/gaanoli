import { Router, Request, Response } from 'express';
import youtubedl from 'youtube-dl-exec';
import { logger } from '../../middleware/logger.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import https from 'https';

export const proxyRouter = Router();

const ALLOWED_QUALITIES = new Set(['1080p', '720p', '480p', '360p']);

/**
 * Request a single, pre-muxed stream (video+audio already combined).
 * This avoids the massive latency of ffmpeg re-muxing separate streams.
 * Falls back to best combined format if the specific resolution isn't available.
 */
function resolveFormat(quality: unknown): string {
  const q = typeof quality === 'string' ? quality : '';
  if (q === '1080p') return 'best[height<=1080][ext=mp4]/best[height<=1080]/best';
  if (q === '480p') return 'best[height<=480][ext=mp4]/best[height<=480]/best';
  if (q === '360p') return 'best[height<=360][ext=mp4]/best[height<=360]/best';
  // Default: 720p
  return 'best[height<=720][ext=mp4]/best[height<=720]/best';
}

/**
 * Video Proxy — streams YouTube video through the GaanOli server.
 * The client never touches youtube.com directly.
 * Uses yt-dlp (via youtube-dl-exec) to stream pre-muxed video directly.
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
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const ytdlOptions: Record<string, unknown> = {
      dumpJson: true,
      noPlaylist: true,
      format: formatString,
      noWarnings: true
    };
    
    // We fetch the metadata to get the direct Google Video URL
    (youtubedl as any)(youtubeUrl, ytdlOptions).then((data: any) => {
      // Find the best URL that contains both video and audio
      // 'best' format string in yt-dlp usually guarantees a combined format, 
      // but we ensure we grab a valid URL.
      let directUrl = data.url;
      if (!directUrl && data.formats) {
         // Fallback to finding the best mp4 that has video and audio
         const validFormat = data.formats.find((f: any) => f.acodec !== 'none' && f.vcodec !== 'none');
         if (validFormat) directUrl = validFormat.url;
      }

      if (!directUrl) {
        throw new Error('Could not extract direct stream URL');
      }

      // Prepare headers for the proxy request
      const proxyHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/'
      };

      // Support HTTP Range requests (crucial for MP4 seeking and fast startup)
      if (req.headers.range) {
        proxyHeaders['Range'] = req.headers.range;
      }

      // Proxy the stream
      const proxyReq = https.get(directUrl, { headers: proxyHeaders }, (proxyRes) => {
        // Forward HTTP status (200 or 206)
        res.status(proxyRes.statusCode || 200);

        // Forward essential headers
        const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
        headersToForward.forEach((header) => {
          if (proxyRes.headers[header]) {
            res.setHeader(header, proxyRes.headers[header]!);
          }
        });
        
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

        // Pipe the video stream directly to the client
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        logger.error('Error proxying video stream', { videoId, error: err.message });
        if (!res.headersSent) res.status(500).end();
      });

      req.on('close', () => {
        proxyReq.destroy();
      });

    }).catch((err: any) => {
      logger.error('YouTube proxy failed to extract metadata', { videoId, error: err.message });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'STREAM_FAILED', message: 'Could not extract stream metadata.' }
        });
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
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video-${videoId}.mp4"`);
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const ytdlProcess = youtubedl.exec(youtubeUrl, {
      output: '-',
      format: formatString,
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
