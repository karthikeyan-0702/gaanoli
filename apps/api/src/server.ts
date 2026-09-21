import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { closeDatabase } from './database/index.js';
import { runMigrations } from './database/migrator.js';
import { ensureDefaultUserExists, ensureGuestUserExists } from './middleware/auth.js';
import { validateProductionSecurity } from './middleware/security.js';
import { closeRedis } from './queues/redis.js';
import { initMediaWorker } from './modules/pipeline/worker.js';
import { checkMediaTools } from './modules/media/ffmpeg.js';
import { seedDatabase } from './database/seeder.js';
import { logger } from './middleware/logger.js';

async function bootstrap() {
  logger.info('Starting GaTube API server initialization...');

  validateProductionSecurity();

  try {
    await checkMediaTools();
    logger.info('FFmpeg runtime verified');
  } catch (err) {
    logger.error('Media runtime verification failed; refusing to start', err);
    process.exit(1);
    return;
  }

  if (config.NODE_ENV === 'production' && config.AUTH_DEV_MODE) {
    logger.warn(
      'AUTH_DEV_MODE is enabled in production — all requests run as the default dev user. Disable AUTH_DEV_MODE and configure Firebase before going live.'
    );
  }

  // Database initialization must succeed before accepting traffic.
  try {
    await runMigrations();
    await ensureDefaultUserExists();
    await ensureGuestUserExists();
    await seedDatabase();
  } catch (err) {
    logger.error('Database initialization failed; refusing to start', err, {
      error: err instanceof Error ? err.message : err
    });
    process.exit(1);
    return;
  }

  // Initialize BullMQ worker
  const mediaWorker = initMediaWorker();
  logger.info('BullMQ Media Pipeline worker initialized');

  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info(`✓ GaTube API server running on port ${config.PORT}`, {
      env: config.NODE_ENV,
      port: config.PORT,
      url: `http://localhost:${config.PORT}`
    });
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await mediaWorker.close();
        await closeDatabase();
        await closeRedis();
        logger.info('Worker, Database and Redis connections closed successfully');
        process.exit(0);
      } catch (err) {
        logger.error('Error during cleanup', err);
        process.exit(1);
      }
    });

    // Force terminate if graceful takes more than 10 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal failure during server bootstrap', err);
  process.exit(1);
});
