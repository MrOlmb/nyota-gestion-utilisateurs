/**
 * Jest setup file for NYOTA security tests
 * Configures test environment, database, and global settings
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(process.cwd(), '.env.test') });

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Ensure test database is available
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Tests must run against test database. Check .env.test configuration.');
  }
});

// Clean up after all tests
afterAll(async () => {
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));
});