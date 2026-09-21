import path from 'path';
import { VideoSourceType } from '@gatube/shared';
import { config } from '../../config/index.js';
import { logger } from '../../middleware/logger.js';
import { assertSafeRemoteMediaUrl, fetchSafeRemoteMedia } from '../../lib/remoteUrl.js';
import { youtubeThumbnailApiPath } from '../../lib/clientPrivacy.js';

export interface ResolvedMetadata {
  source: VideoSourceType;
  sourceId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isDownloadable: boolean;
  directMediaUrl?: string;
}

export interface MediaSourceHandler {
  type: VideoSourceType;
  canHandle(url: string): boolean;
  resolve(url: string): Promise<ResolvedMetadata>;
}

export class YouTubeSourceHandler implements MediaSourceHandler {
  type: VideoSourceType = 'youtube';

  canHandle(url: string): boolean {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
  }

  private extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2] && match[2].length === 11 ? match[2] : null;
  }

  async resolve(url: string): Promise<ResolvedMetadata> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube video URL. Could not parse video ID.');
    }

    // Default metadata using standard YouTube CDN poster
    let title = `YouTube Video (${videoId})`;
    let channelTitle = 'YouTube Creator';
    let description = 'Streamed via official YouTube embedded player.';
    const thumbnailUrl = youtubeThumbnailApiPath(videoId);
    let durationSeconds = 0;

    // Fetch official metadata via YouTube oEmbed without scraping
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as any;
        title = oembed.title || title;
        channelTitle = oembed.author_name || channelTitle;
      }
    } catch (err) {
      logger.debug('YouTube oEmbed metadata fallback used', { videoId });
    }

    // If official API key is provided, query YouTube Data API v3 for duration & detailed description
    if (config.YOUTUBE_API_KEY) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${config.YOUTUBE_API_KEY}`;
        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
          const apiData = (await apiRes.json()) as any;
          const item = apiData.items?.[0];
          if (item) {
            title = item.snippet?.title || title;
            channelTitle = item.snippet?.channelTitle || channelTitle;
            description = item.snippet?.description || description;
            // Parse ISO 8601 duration e.g. PT4M13S
            const isoDuration = item.contentDetails?.duration || '';
            const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
              const h = parseInt(match[1] || '0', 10);
              const m = parseInt(match[2] || '0', 10);
              const s = parseInt(match[3] || '0', 10);
              durationSeconds = h * 3600 + m * 60 + s;
            }
          }
        }
      } catch (err) {
        logger.warn('YouTube Data API query failed', { error: err instanceof Error ? err.message : err });
      }
    }

    return {
      source: 'youtube',
      sourceId: videoId,
      title,
      channelTitle,
      description,
      thumbnailUrl,
      durationSeconds,
      isDownloadable: false // Strict compliance: YouTube downloads are disabled
    };
  }
}

export class AuthorizedDirectSourceHandler implements MediaSourceHandler {
  type: VideoSourceType = 'authorized_source';

  canHandle(url: string): boolean {
    const isHttp = /^https?:\/\/.+/i.test(url);
    if (!isHttp) return false;
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    const commonVideoExts = ['.mp4', '.webm', '.mkv', '.mov', '.m4v'];
    return commonVideoExts.includes(ext) || url.includes('/sample/') || url.includes('/video/');
  }

  async resolve(url: string): Promise<ResolvedMetadata> {
    const parsedUrl = await assertSafeRemoteMediaUrl(url);
    const pathname = parsedUrl.pathname;
    const filename = path.basename(pathname) || 'video.mp4';
    const fallbackTitle = filename.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');

    let title = fallbackTitle.charAt(0).toUpperCase() + fallbackTitle.slice(1);
    let channelTitle = parsedUrl.hostname;
    let description = `Authorized direct media stream from ${parsedUrl.hostname}`;

    // Validate remote URL via HTTP HEAD request
    try {
      const headRes = await fetchSafeRemoteMedia(url, { method: 'HEAD' });
      if (!headRes.ok) {
        throw new Error(`Media URL returned HTTP ${headRes.status}: ${headRes.statusText}`);
      }
      const contentType = headRes.headers.get('content-type') || '';
      if (contentType && !contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
        throw new Error(`URL does not return a supported video stream (Content-Type: ${contentType})`);
      }
    } catch (err) {
      logger.warn('HEAD request check failed for direct source', { url, error: err instanceof Error ? err.message : err });
    }

    const uniqueId = Buffer.from(url).toString('base64url').substring(0, 32);

    return {
      source: 'authorized_source',
      sourceId: uniqueId,
      title,
      channelTitle,
      description,
      thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=640&auto=format&fit=crop&q=80',
      durationSeconds: 0,
      isDownloadable: true,
      directMediaUrl: url
    };
  }
}

export class MediaSourceRegistry {
  private handlers: MediaSourceHandler[] = [
    new YouTubeSourceHandler(),
    new AuthorizedDirectSourceHandler()
  ];

  public resolve(url: string): Promise<ResolvedMetadata> {
    for (const handler of this.handlers) {
      if (handler.canHandle(url)) {
        return handler.resolve(url);
      }
    }
    throw new Error(
      'Unsupported URL format. GaTube supports official YouTube links and direct authorized video URLs (MP4, WebM).'
    );
  }
}

export const sourceRegistry = new MediaSourceRegistry();
