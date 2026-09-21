import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { redactRequestPath } from '../lib/clientPrivacy.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret', 'apikey', 'key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (LOG_LEVELS.DEBUG >= LOG_LEVELS[currentLevel]) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'DEBUG', message, context: sanitize(context) }));
    }
  },
  info(message: string, context?: Record<string, unknown>) {
    if (LOG_LEVELS.INFO >= LOG_LEVELS[currentLevel]) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'INFO', message, context: sanitize(context) }));
    }
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (LOG_LEVELS.WARN >= LOG_LEVELS[currentLevel]) {
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', message, context: sanitize(context) }));
    }
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (LOG_LEVELS.ERROR >= LOG_LEVELS[currentLevel]) {
      const errObj = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message,
        error: errObj,
        context: sanitize(context)
      }));
    }
  }
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: redactRequestPath(req.originalUrl || req.url),
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.get('user-agent')
    });
  });

  next();
}
