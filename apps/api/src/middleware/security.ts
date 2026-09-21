import { config } from '../config/index.js';
import { getConfiguredAccounts } from '../lib/appAccounts.js';
import { logger } from './logger.js';

export function validateProductionSecurity(): void {
  if (config.NODE_ENV !== 'production') {
    return;
  }

  const failures: string[] = [];

  if (config.AUTH_DEV_MODE) {
    failures.push('AUTH_DEV_MODE must be false in production');
  }

  if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 32) {
    failures.push('SESSION_SECRET must be at least 32 characters in production');
  }
  if (config.SESSION_SECRET === 'dev-only-change-me-not-for-production-use') {
    failures.push('SESSION_SECRET must be replaced with a unique production secret');
  }

  if (config.API_URL.includes('localhost') || config.API_URL.includes('127.0.0.1')) {
    failures.push('API_URL must point to the production API in production');
  }
  if (config.WEB_URL.includes('localhost') || config.WEB_URL.includes('127.0.0.1')) {
    failures.push('WEB_URL must point to the production web origin in production');
  }
  if (config.DATABASE_URL.includes('127.0.0.1') || config.DATABASE_URL.includes('localhost')) {
    failures.push('DATABASE_URL must point to a production database in production');
  }
  if (config.REDIS_URL.includes('127.0.0.1') || config.REDIS_URL.includes('localhost')) {
    failures.push('REDIS_URL must point to a production Redis instance in production');
  }

  const accounts = getConfiguredAccounts();
  if (!accounts.some((account) => account.role === 'admin')) {
    failures.push('Configure ADMIN_USERNAME + ADMIN_PASSWORD_HASH (and optional guest account)');
  }

  for (const account of accounts) {
    if (account.passwordHash.startsWith('plain$')) {
      failures.push(`Account "${account.username}" uses a plain password; set *_PASSWORD_HASH in production`);
    }
  }

  if (failures.length > 0) {
    for (const msg of failures) {
      logger.error(`Security configuration error: ${msg}`);
    }
    process.exit(1);
  }

  logger.info('Production security checks passed');
}
