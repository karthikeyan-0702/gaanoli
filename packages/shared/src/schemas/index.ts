import { z } from 'zod';

export const SearchQuerySchema = z.object({
  // Empty query lists recent videos (Discover browse mode)
  query: z.string().trim().max(200, 'Search query too long').default(''),
  source: z.enum(['all', 'youtube', 'authorized_source', 'local']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  pageToken: z.string().optional()
});

export type SearchQueryDto = z.infer<typeof SearchQuerySchema>;

export const ImportUrlSchema = z.object({
  url: z.string().trim().url('Please enter a valid URL')
});

export type ImportUrlDto = z.infer<typeof ImportUrlSchema>;

export const CreatePlaylistSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().trim().max(500, 'Description must be under 500 characters').default(''),
  isPrivate: z.boolean().default(false)
});

export type CreatePlaylistDto = z.infer<typeof CreatePlaylistSchema>;

export const UpdatePlaylistSchema = CreatePlaylistSchema.partial();
export type UpdatePlaylistDto = z.infer<typeof UpdatePlaylistSchema>;

export const AddPlaylistItemSchema = z.object({
  videoId: z.string().uuid('Invalid video ID'),
  position: z.number().int().min(0).optional()
});

export type AddPlaylistItemDto = z.infer<typeof AddPlaylistItemSchema>;

export const ReorderPlaylistItemsSchema = z.object({
  itemIds: z.array(z.string().uuid('Invalid item ID')).min(1)
});

export type ReorderPlaylistItemsDto = z.infer<typeof ReorderPlaylistItemsSchema>;

export const UpdateHistorySchema = z.object({
  videoId: z.string().uuid('Invalid video ID'),
  positionSeconds: z.number().min(0, 'Position must be positive'),
  durationSeconds: z.number().nullable().optional()
});

export type UpdateHistoryDto = z.infer<typeof UpdateHistorySchema>;

export const CreateNoteSchema = z.object({
  videoId: z.string().uuid('Invalid video ID'),
  timestampSeconds: z.number().min(0).optional().nullable(),
  content: z.string().trim().min(1, 'Note content cannot be empty').max(2000, 'Note must be under 2000 characters')
});

export type CreateNoteDto = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note content cannot be empty').max(2000, 'Note must be under 2000 characters')
});

export type UpdateNoteDto = z.infer<typeof UpdateNoteSchema>;

export const DownloadJobActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel', 'retry'])
});

export type DownloadJobActionDto = z.infer<typeof DownloadJobActionSchema>;
