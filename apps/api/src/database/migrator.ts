import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';
import { logger } from '../middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info('Initializing migration tracker table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('No migrations directory found', { migrationsDir });
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    const { rows: executedRows } = await client.query('SELECT name FROM _migrations');
    const executedSet = new Set(executedRows.map((r) => r.name));

    for (const file of files) {
      if (executedSet.has(file)) {
        logger.debug(`Migration already applied: ${file}`);
        continue;
      }

      logger.info(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info(`✓ Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`❌ Migration failed: ${file}`, err);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

// Run directly when executed via script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration execution failed', err);
      process.exit(1);
    });
}
