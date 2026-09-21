import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../middleware/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL client error', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Database Query Executed', { text, duration, rowCount: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database Query Failed', error, { text, params });
    throw error;
  }
}

export async function checkDatabaseHealth(): Promise<{ isHealthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { isHealthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return { isHealthy: false, latencyMs: Date.now() - start, error: message };
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}
