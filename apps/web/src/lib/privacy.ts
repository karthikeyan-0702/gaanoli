import { isPrivacyMode, streamSourceLabel } from './mediaUrls';

export { isPrivacyMode, streamSourceLabel };

export function privacyPlaybackHint(source: string): string {
  if (isPrivacyMode() && source === 'youtube') {
    return 'Played through your media server';
  }
  if (source === 'youtube') return 'Streamed via proxy';
  return 'Played from your library';
}
