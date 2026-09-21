import type { VideoSourceType } from '@gatube/shared';

/** When true, the browser only talks to this origin (via Vite proxy or reverse proxy). */
export function useRelativeApi(): boolean {
  return import.meta.env.VITE_USE_RELATIVE_API !== 'false';
}

export function getApiBaseUrl(): string {
  if (useRelativeApi()) {
    return '';
  }
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:4000';
}

export function apiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function isPrivacyMode(): boolean {
  return import.meta.env.VITE_PRIVACY_MODE !== 'false';
}

export function getThumbnailSrc(video: {
  source: VideoSourceType | string;
  sourceId: string;
  thumbnailUrl?: string | null;
}): string {
  if (video.source === 'youtube' && video.sourceId) {
    return apiUrl(`/api/proxy/youtube/${video.sourceId}/thumbnail`);
  }
  if (video.thumbnailUrl?.startsWith('/api/')) {
    return apiUrl(video.thumbnailUrl);
  }
  if (video.thumbnailUrl?.startsWith('/')) {
    return apiUrl(video.thumbnailUrl);
  }
  if (video.thumbnailUrl) {
    return apiUrl(`/api/proxy/image?url=${encodeURIComponent(video.thumbnailUrl)}`);
  }
  return '';
}

export function getYoutubeStreamUrl(sourceId: string, quality?: string): string {
  const q = quality ? `?quality=${encodeURIComponent(quality)}` : '';
  return apiUrl(`/api/proxy/youtube/${sourceId}${q}`);
}

export function getYoutubeDownloadUrl(sourceId: string, quality?: string): string {
  const q = quality ? `?quality=${encodeURIComponent(quality)}` : '';
  return apiUrl(`/api/proxy/youtube/${sourceId}/download${q}`);
}

export function streamSourceLabel(source: VideoSourceType | string): string {
  if (isPrivacyMode() && source === 'youtube') {
    return 'Stream';
  }
  if (source === 'youtube') return 'YouTube';
  if (source === 'authorized_source') return 'Direct';
  return 'Media';
}
