import { VideoSourceType } from '@gatube/shared';

const GOOGLE_MEDIA_HOSTS = [
  'youtube.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'ggpht.com',
  'googleusercontent.com',
  'googleapis.com'
];

export function youtubeThumbnailApiPath(videoId: string): string {
  return `/api/proxy/youtube/${videoId}/thumbnail`;
}

export function isGoogleMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return GOOGLE_MEDIA_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function sanitizeThumbnailUrl(
  source: VideoSourceType,
  sourceId: string,
  thumbnailUrl?: string | null
): string {
  if (source === 'youtube' && sourceId) {
    return youtubeThumbnailApiPath(sourceId);
  }
  if (thumbnailUrl && isGoogleMediaUrl(thumbnailUrl) && sourceId) {
    return youtubeThumbnailApiPath(sourceId);
  }
  return thumbnailUrl || '';
}

export function sanitizeVideoLike<T extends Record<string, unknown>>(video: T): T {
  if (!video || typeof video !== 'object') return video;
  if (!('source' in video) || !('sourceId' in video)) return video;

  const source = video.source as VideoSourceType;
  const sourceId = String(video.sourceId);
  const thumbnailUrl = 'thumbnailUrl' in video ? (video.thumbnailUrl as string | null | undefined) : undefined;

  return {
    ...video,
    thumbnailUrl: sanitizeThumbnailUrl(source, sourceId, thumbnailUrl)
  };
}

export function sanitizePayloadForClient<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForClient(item)) as T;
  }
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const withThumb =
    'source' in record && 'sourceId' in record && 'thumbnailUrl' in record
      ? sanitizeVideoLike(record)
      : record;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(withThumb)) {
    out[key] = sanitizePayloadForClient(value);
  }
  return out as T;
}

export function redactRequestPath(path: string): string {
  if (path.startsWith('/api/proxy/image')) {
    return '/api/proxy/image?[redacted]';
  }
  const qIndex = path.indexOf('?');
  if (qIndex === -1) return path;
  const base = path.slice(0, qIndex);
  if (base.startsWith('/api/proxy/youtube/')) {
    return `${base}?[redacted]`;
  }
  return path;
}
