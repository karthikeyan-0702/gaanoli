export const APP_NAME = 'GaTube';
export const APP_DESCRIPTION = 'GaTube — Production-Grade Personal Video Platform';

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  DOWNLOAD_UNAUTHORIZED: 'DOWNLOAD_UNAUTHORIZED',
  STORAGE_LIMIT_EXCEEDED: 'STORAGE_LIMIT_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const MEDIA_SOURCES = {
  YOUTUBE: 'youtube',
  LOCAL: 'local',
  AUTHORIZED_SOURCE: 'authorized_source'
} as const;
