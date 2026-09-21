import {
  User,
  Video,
  VideoWithUserData,
  Playlist,
  WatchHistoryItem,
  VideoNote,
  DownloadJob,
  StorageStats
} from '@gatube/shared';

import { apiUrl, getApiBaseUrl } from '../lib/mediaUrls';

function resolveApiBase(): string {
  const base = getApiBaseUrl();
  return base || (import.meta.env.DEV ? 'http://localhost:4000' : '');
}

export interface LibraryData {
  favorites: Video[];
  downloads: Video[];
  history: (Video & { lastPositionSeconds: number; progressPercent: number; lastWatchedAt: string })[];
  playlists: Playlist[];
}

export interface DownloadsData {
  active: DownloadJob[];
  completed: DownloadJob[];
}

export interface PlaylistWithItems extends Playlist {
  items: Array<{
    id: string;
    playlistId: string;
    videoId: string;
    position: number;
    addedAt: string;
    video: Video;
  }>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private extractErrorMessage(json: unknown, status: number, statusText: string): string {
    if (json && typeof json === 'object' && 'error' in json) {
      const err = (json as { error?: unknown }).error;
      if (typeof err === 'string' && err.trim()) return err;
      if (err && typeof err === 'object' && 'message' in err) {
        const message = (err as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
      }
    }
    return `API Error: ${status} ${statusText}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const json = isJson ? await response.json() : null;

      if (!response.ok || (json && typeof json === 'object' && (json as { success?: boolean }).success === false)) {
        throw new Error(this.extractErrorMessage(json, response.status, response.statusText));
      }

      if (json && typeof json === 'object' && 'data' in json && (json as { data?: unknown }).data !== undefined) {
        return (json as { data: T }).data;
      }

      return json as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to GaTube API server. Please ensure the backend is running.');
      }
      throw error;
    }
  }

  // System
  public async getHealth(): Promise<{ status: string; uptimeSeconds: number }> {
    return this.request('/health');
  }

  public async getReadiness(): Promise<{
    status: string;
    services: {
      database: { isHealthy: boolean; latencyMs: number; error?: string };
      redis: { isHealthy: boolean; latencyMs: number; error?: string };
      storage: { isHealthy: boolean; latencyMs: number; error?: string };
    };
  }> {
    return this.request('/health/ready');
  }

  public async login(username: string, password: string): Promise<{ role: 'admin' | 'guest'; username: string }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  public async logout(): Promise<{ loggedOut: boolean }> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  public async getSession(): Promise<{ role: 'admin' | 'guest'; userId: string }> {
    return this.request('/api/auth/session');
  }

  public async getCurrentUser(): Promise<User> {
    return this.request('/api/auth/me');
  }

  public async getStorageStats(): Promise<StorageStats> {
    return this.request('/api/storage/stats');
  }

  // Search & Videos
  public async searchVideos(query = '', source = 'all', limit = 20): Promise<Video[]> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (source !== 'all') params.append('source', source);
    params.append('limit', limit.toString());

    return this.request(`/api/search?${params.toString()}`);
  }

  public async getFeed(): Promise<Video[]> {
    return this.request('/api/feed');
  }

  public async getVideo(id: string): Promise<VideoWithUserData> {
    return this.request(`/api/videos/${id}`);
  }

  public async importVideo(url: string): Promise<Video> {
    return this.request('/api/videos/import', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  }

  // Library & Favorites
  public async getLibrary(): Promise<LibraryData> {
    return this.request('/api/library');
  }

  public async getFavorites(): Promise<Video[]> {
    return this.request('/api/favorites');
  }

  public async addFavorite(videoId: string): Promise<{ isFavorite: boolean }> {
    return this.request(`/api/favorites/${videoId}`, { method: 'POST' });
  }

  public async removeFavorite(videoId: string): Promise<{ isFavorite: boolean }> {
    return this.request(`/api/favorites/${videoId}`, { method: 'DELETE' });
  }

  // Playlists
  public async getPlaylists(): Promise<Playlist[]> {
    return this.request('/api/playlists');
  }

  public async getPlaylist(id: string): Promise<PlaylistWithItems> {
    return this.request(`/api/playlists/${id}`);
  }

  public async createPlaylist(name: string, description = '', isPrivate = false): Promise<Playlist> {
    return this.request('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, isPrivate })
    });
  }

  public async deletePlaylist(id: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/playlists/${id}`, { method: 'DELETE' });
  }

  public async addPlaylistItem(playlistId: string, videoId: string): Promise<{ added: boolean }> {
    return this.request(`/api/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ videoId })
    });
  }

  public async removePlaylistItem(playlistId: string, videoId: string): Promise<{ removed: boolean }> {
    return this.request(`/api/playlists/${playlistId}/items/${videoId}`, { method: 'DELETE' });
  }

  // Watch History
  public async getHistory(): Promise<WatchHistoryItem[]> {
    return this.request('/api/history');
  }

  public async updateHistory(
    videoId: string,
    positionSeconds: number,
    durationSeconds: number
  ): Promise<{ progressPercent: number; isCompleted: boolean }> {
    return this.request('/api/history', {
      method: 'POST',
      body: JSON.stringify({ videoId, positionSeconds, durationSeconds })
    });
  }

  public async deleteHistoryItem(id: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/history/${id}`, { method: 'DELETE' });
  }

  public async clearHistory(): Promise<{ cleared: boolean }> {
    return this.request('/api/history', { method: 'DELETE' });
  }

  // Timestamped Notes
  public async getNotes(videoId: string): Promise<VideoNote[]> {
    return this.request(`/api/notes/${videoId}`);
  }

  public async createNote(
    videoId: string,
    content: string,
    timestampSeconds?: number | null
  ): Promise<VideoNote> {
    return this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ videoId, content, timestampSeconds })
    });
  }

  public async deleteNote(id: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/notes/${id}`, { method: 'DELETE' });
  }

  // Downloads & Real-time pipeline
  public async getDownloads(): Promise<DownloadsData> {
    return this.request('/api/downloads');
  }

  public async createDownload(videoId: string): Promise<{ jobId: string; status: string }> {
    return this.request('/api/downloads', {
      method: 'POST',
      body: JSON.stringify({ videoId })
    });
  }

  public async cancelDownload(id: string): Promise<{ status: string }> {
    return this.request(`/api/downloads/${id}/cancel`, { method: 'POST' });
  }

  public async deleteDownload(id: string): Promise<{ deleted: boolean }> {
    return this.request(`/api/downloads/${id}`, { method: 'DELETE' });
  }

  public subscribeDownloadEvents(
    onMessage: (event: { type: string; jobId: string; videoId: string; data: any }) => void
  ): () => void {
    const eventSource = new EventSource(apiUrl('/api/downloads/events'), { withCredentials: true });

    const handler = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        onMessage(parsed);
      } catch {
        // Keepalive or parse error
      }
    };

    eventSource.addEventListener('download.started', handler);
    eventSource.addEventListener('download.progress', handler);
    eventSource.addEventListener('download.processing', handler);
    eventSource.addEventListener('download.completed', handler);
    eventSource.addEventListener('download.failed', handler);

    return () => {
      eventSource.close();
    };
  }
}

export const api = new ApiClient(resolveApiBase());
