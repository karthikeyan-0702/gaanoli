import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { sanitizePayloadForClient } from '../lib/clientPrivacy.js';

/**
 * Rewrites API JSON so browsers never receive Google/YouTube CDN thumbnail URLs.
 */
export function clientPrivacyResponseMiddleware(_req: Request, res: Response, next: NextFunction): void {
  if (!config.CLIENT_PRIVACY_MODE) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (body && typeof body === 'object' && 'data' in (body as object)) {
      const envelope = body as { data?: unknown };
      return originalJson({
        ...(body as object),
        data: sanitizePayloadForClient(envelope.data)
      });
    }
    return originalJson(body);
  };

  next();
}
