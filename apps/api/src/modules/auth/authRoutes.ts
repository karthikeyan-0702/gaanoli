import { Router, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@gatube/shared';
import { verifyAccountLogin } from '../../lib/appAccounts.js';
import {
  createSessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
  verifySessionToken
} from '../../lib/session.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128)
});

export const authRouter = Router();

authRouter.post('/api/auth/login', (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const body = LoginSchema.parse(req.body);
    const account = verifyAccountLogin(body.username, body.password);

    if (!account) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Invalid username or password', 401);
    }

    const token = createSessionToken({ sub: account.userId, role: account.role });
    res.cookie(getSessionCookieName(), token, getSessionCookieOptions());

    res.json({
      success: true,
      data: {
        role: account.role,
        username: account.username
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.clearCookie(getSessionCookieName(), { path: '/' });
  res.json({ success: true, data: { loggedOut: true } });
});

authRouter.get('/api/auth/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const cookieToken = req.cookies?.[getSessionCookieName()] as string | undefined;
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = cookieToken || bearer;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    res.status(401).json({
      success: false,
      error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Not authenticated' }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      role: session.role,
      userId: session.sub
    }
  });
});

authRouter.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: req.user
  });
});
