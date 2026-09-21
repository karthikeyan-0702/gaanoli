import fs from 'fs';
import path from 'path';
import { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { config } from '../config/index.js';
import { logger } from './logger.js';

export function attachWebStatic(app: Express): void {
  if (!config.SERVE_WEB_STATIC) {
    return;
  }

  const webRoot = path.resolve(config.WEB_DIST_PATH);
  if (!fs.existsSync(webRoot)) {
    logger.warn('SERVE_WEB_STATIC is enabled but web dist folder was not found', { webRoot });
    return;
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
