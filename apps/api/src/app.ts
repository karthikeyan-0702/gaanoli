import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { clientPrivacyResponseMiddleware } from './middleware/clientPrivacy.js';
import { apiRouter } from './routes/index.js';
import { attachWebStatic } from './middleware/serveWeb.js';

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production'
      ? {
          useDefaults: true,
          directives: {
            'default-src': ["'self'"],
            'img-src': ["'self'", 'data:', 'blob:'],
            'media-src': ["'self'", 'blob:'],
            'script-src': ["'self'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'connect-src': ["'self'"],
            'font-src': ["'self'"],
            'object-src': ["'none'"],
            'frame-ancestors': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: config.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
  }));

  const corsOrigins = [
    config.WEB_URL,
    config.API_URL,
    ...(config.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:5174'])
  ].filter((origin, index, all) => origin && all.indexOf(origin) === index);

  // CORS (same-origin Render deploy does not need this; required for Vercel UI + Render API)
  app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
  }));

  const allowedOriginSet = new Set(corsOrigins);
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }

    const requestOrigin = req.headers.origin || (() => {
      const referer = req.headers.referer;
      if (!referer) return undefined;
      try {
        return new URL(referer).origin;
      } catch {
        return undefined;
      }
    })();

    const isSameOrigin = 
      requestOrigin === `http://${req.headers.host}` || 
      requestOrigin === `https://${req.headers.host}`;

    if (requestOrigin && !allowedOriginSet.has(requestOrigin) && !isSameOrigin) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Request origin is not allowed' }
      });
      return;
    }

    next();
  });

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.NODE_ENV === 'production' ? 600 : 2000,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', globalLimiter);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } }
  });
  app.use('/api/auth/login', loginLimiter);

  const proxyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.NODE_ENV === 'production' ? 40 : 120,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/proxy/', proxyLimiter);

  app.use(cookieParser(config.SESSION_SECRET));

  // Body Parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging
  app.use(requestLogger);

  // Sanitize outbound JSON (no Google CDN URLs to the browser)
  app.use(clientPrivacyResponseMiddleware);

  // Mount API & System Routes
  app.use(apiRouter);

  attachWebStatic(app);

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
