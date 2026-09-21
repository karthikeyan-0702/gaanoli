import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function attachWebStatic(app: Express): void {
  if (!config.SERVE_WEB_STATIC) {
    return;
  }

  let webRoot = path.resolve(config.WEB_DIST_PATH);
  if (!fs.existsSync(webRoot)) {
    // Fallback: If running inside apps/api, try to find it relative to the monorepo root
    const rootFallback = path.resolve(__dirname, '../../../../../apps/web/dist');
    if (fs.existsSync(rootFallback)) {
      webRoot = rootFallback;
    } else {
      logger.warn('SERVE_WEB_STATIC is enabled but web dist folder was not found', { webRoot, rootFallback });
      return;
    }
  }

  logger.info('Serving web UI from disk (single-origin deployment)', { webRoot });

  app.use(
    express.static(webRoot, {
      index: false,
      maxAge: config.NODE_ENV === 'production' ? '1d' : 0
    })
  );

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next();
      return;
    }
    res.sendFile(path.join(webRoot, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}
