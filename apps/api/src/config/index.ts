import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root workspace or cwd
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

/** Parse env booleans reliably (`z.coerce.boolean()` treats the string "false" as true). */
function envBoolean(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
      return defaultValue;
    });
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:5174'),

  // Serve built React app from the API process (one URL for browser — best for privacy / campus filters)
  SERVE_WEB_STATIC: envBoolean(false),
  WEB_DIST_PATH: z.string().default('apps/web/dist'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://gatube:gatube_secret_change_in_prod@127.0.0.1:5433/gatubedb'),
  POSTGRES_HOST: z.string().default('127.0.0.1'),
  POSTGRES_PORT: z.coerce.number().default(5433),
  POSTGRES_USER: z.string().default('gatube'),
  POSTGRES_PASSWORD: z.string().default('gatube_secret_change_in_prod'),
  POSTGRES_DB: z.string().default('gatubedb'),

  // Redis
  REDIS_URL: z.string().default('redis://127.0.0.1:6380'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6380),

  // Storage
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().default(524288000), // 500MB
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),

  // YouTube API
  YOUTUBE_API_KEY: z.string().optional(),

  // Strip Google/YouTube URLs from API JSON (thumbnails served only via /api/proxy/*)
  CLIENT_PRIVACY_MODE: envBoolean(true),

  // Session & login (required in production)
  SESSION_SECRET: z.string().default('dev-only-change-me-not-for-production-use'),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  GUEST_USERNAME: z.string().optional(),
  GUEST_PASSWORD_HASH: z.string().optional(),
  GUEST_PASSWORD: z.string().optional(),

  // Auth
  AUTH_DEV_MODE: envBoolean(true),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
