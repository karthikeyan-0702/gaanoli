import { Request, Response, NextFunction } from 'express';
import { User, ERROR_CODES } from '@gatube/shared';
import { config } from '../config/index.js';
import { query } from '../database/index.js';
import { AppError } from './errorHandler.js';
import { logger } from './logger.js';
import { verifySessionToken, AppRole, getSessionCookieName } from '../lib/session.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  appRole?: AppRole;
}

export const DEV_DEFAULT_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@gatube.local',
  displayName: 'GaTube Admin',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const GUEST_DEFAULT_USER: User = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'guest@gatube.local',
  displayName: 'Guest',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export async function ensureDefaultUserExists(): Promise<void> {
  try {
    await query(
      `INSERT INTO users (id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [DEV_DEFAULT_USER.id, DEV_DEFAULT_USER.email, DEV_DEFAULT_USER.displayName, DEV_DEFAULT_USER.avatarUrl]
    );
    logger.debug('Default user verified in database', { userId: DEV_DEFAULT_USER.id });
  } catch (err) {
    logger.error('Failed to ensure default user in database', err);
    throw err;
  }
}

export async function ensureGuestUserExists(): Promise<void> {
  try {
    await query(
      `INSERT INTO users (id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [GUEST_DEFAULT_USER.id, GUEST_DEFAULT_USER.email, GUEST_DEFAULT_USER.displayName, GUEST_DEFAULT_USER.avatarUrl]
    );
  } catch (err) {
    logger.error('Failed to ensure guest user in database', err);
    throw err;
  }
}

async function resolveUserById(userId: string, role: AppRole): Promise<User> {
  if (role === 'guest') return GUEST_DEFAULT_USER;
  if (userId === DEV_DEFAULT_USER.id) return DEV_DEFAULT_USER;

  const res = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (res.rowCount === 0) {
    return DEV_DEFAULT_USER;
  }
  const row = res.rows[0];
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (config.AUTH_DEV_MODE && config.NODE_ENV !== 'production') {
      req.user = DEV_DEFAULT_USER;
      req.appRole = 'admin';
      return next();
    }

    const cookieToken = req.cookies?.[getSessionCookieName()] as string | undefined;
    const bearer =
      req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const session = verifySessionToken(cookieToken || bearer || '');

    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    req.appRole = session.role;
    req.user = await resolveUserById(session.sub, session.role);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (req.appRole !== 'admin') {
    next(new AppError(ERROR_CODES.FORBIDDEN, 'Admin access required', 403));
    return;
  }
  next();
}
