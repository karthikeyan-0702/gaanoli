import { AppRole } from './session.js';
import { verifyPassword } from './password.js';
import { config } from '../config/index.js';
import { DEV_DEFAULT_USER } from '../middleware/auth.js';

export interface AuthAccount {
  username: string;
  passwordHash: string;
  role: AppRole;
  userId: string;
}

function loadAccount(
  username: string | undefined,
  passwordHash: string | undefined,
  plainPassword: string | undefined,
  role: AppRole,
  userId: string
): AuthAccount | null {
  if (!username) return null;

  let hash = passwordHash?.trim();
  if (!hash && plainPassword && config.NODE_ENV === 'development') {
    hash = `plain$${plainPassword}`;
  }
  if (!hash) return null;

  return { username, passwordHash: hash, role, userId };
}

export function getConfiguredAccounts(): AuthAccount[] {
  const guestId = '00000000-0000-0000-0000-000000000002';

  const accounts = [
    loadAccount(
      config.ADMIN_USERNAME,
      config.ADMIN_PASSWORD_HASH,
      config.ADMIN_PASSWORD,
      'admin',
      DEV_DEFAULT_USER.id
    ),
    loadAccount(
      config.GUEST_USERNAME,
      config.GUEST_PASSWORD_HASH,
      config.GUEST_PASSWORD,
      'guest',
      guestId
    )
  ].filter((a): a is AuthAccount => a !== null);

  return accounts;
}

export function verifyAccountLogin(username: string, password: string): AuthAccount | null {
  const normalized = username.trim();
  const account = getConfiguredAccounts().find((a) => a.username === normalized);
  if (!account) return null;

  const stored = account.passwordHash;
  if (stored.startsWith('plain$')) {
    const plain = stored.slice('plain$'.length);
    if (password !== plain) return null;
    return account;
  }

  if (!verifyPassword(password, stored)) return null;
  return account;
}
