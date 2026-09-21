import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config/index.js';

export type AppRole = 'admin' | 'guest';

export interface SessionPayload {
  sub: string;
  role: AppRole;
  exp: number;
}

const SESSION_COOKIE = 'gaanoli_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(body: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(body).digest('base64url');
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const full: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || !['admin', 'guest'].includes(payload.role) || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  };
}
