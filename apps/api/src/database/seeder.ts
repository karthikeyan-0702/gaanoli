import { logger } from '../middleware/logger.js';

export async function seedDatabase(): Promise<void> {
  logger.info('Checking database seed data...');
  // Seed data removed by user request
}
