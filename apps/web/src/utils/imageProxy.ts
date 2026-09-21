import { apiUrl, getThumbnailSrc } from '../lib/mediaUrls';

/** @deprecated Use getThumbnailSrc(video) */
export function getImageProxyUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('/api/')) {
    return apiUrl(url);
  }
  return getThumbnailSrc({ source: 'authorized_source', sourceId: '', thumbnailUrl: url });
}

export { getThumbnailSrc };
