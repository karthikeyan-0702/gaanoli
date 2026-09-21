export type VideoSourceType = 'youtube' | 'local' | 'authorized_source';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  source: VideoSourceType;
  sourceId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isDownloadable: boolean;
  isDownloaded: boolean;
  playbackUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoWithUserData extends Video {
  isFavorite?: boolean;
  lastPositionSeconds?: number;
  watchProgressPercent?: number;
  notesCount?: number;
}

export type JobStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PROCESSING'
  | 'STORING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface DownloadJob {
  id: string;
  userId: string;
  videoId: string;
  video?: Video;
  status: JobStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  videoCount: number;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  videoId: string;
  position: number;
  video: Video;
  addedAt: string;
}

export interface WatchHistoryItem {
  id: string;
  userId: string;
  videoId: string;
  video: Video;
  lastPositionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  isCompleted: boolean;
  lastWatchedAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  createdAt: string;
}

export interface VideoNote {
  id: string;
  userId: string;
  videoId: string;
  timestampSeconds?: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFile {
  id: string;
  videoId: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  format: string;
  resolution?: string | null;
  createdAt: string;
}

export interface StorageStats {
  usedBytes: number;
  maxBytes: number;
  availableBytes: number;
  fileCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
