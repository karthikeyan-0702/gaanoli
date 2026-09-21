import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../middleware/logger.js';

const isTls = config.REDIS_URL.startsWith('rediss://');

export const redisClient = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  family: 0, // Railway uses IPv6 for internal networking
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
});

redisClient.on('connect', () => {
  logger.info('Redis connection established');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', err);
});

export async function checkRedisHealth(): Promise<{ isHealthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
      await redisClient.connect();
    }
    await redisClient.ping();
    return { isHealthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    return { isHealthy: false, latencyMs: Date.now() - start, error: message };
  }
}

export async function closeRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('Redis client disconnected');
  } catch (err) {
    logger.error('Error closing Redis connection', err);
  }
}
