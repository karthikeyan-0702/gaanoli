import { Router } from 'express';
import { checkDatabaseHealth } from '../database/index.js';
import { checkRedisHealth } from '../queues/redis.js';
import { storageService } from '../storage/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

healthRouter.get('/health/ready', async (_req, res) => {
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth()
  ]);

  let storageStatus: {
    isHealthy: boolean;
    latencyMs: number;
    stats?: Awaited<ReturnType<typeof storageService.getStats>>;
    error?: string;
  };
  const storageStart = Date.now();
  try {
    const stats = await storageService.getStats();
    storageStatus = { isHealthy: true, latencyMs: Date.now() - storageStart, stats };
  } catch (error) {
    storageStatus = {
      isHealthy: false,
      latencyMs: Date.now() - storageStart,
      error: error instanceof Error ? error.message : 'Unknown storage error'
    };
  }

  const isHealthy = dbStatus.isHealthy && redisStatus.isHealthy && storageStatus.isHealthy;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      storage: storageStatus
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    }
  });
});
