import type { Express } from 'express';
import { loadEnv } from '../../src/config/env.js';
import { buildApi } from '../../src/container.js';
import { createLogger } from '../../src/core/logger.js';
import type { Database } from '../../src/db/client.js';
import { NotificationListener } from '../../src/db/notification-listener.js';
import { testDatabaseUrl } from './database.js';
import { InMemoryObjectStorage } from './in-memory-object-storage.js';

export function createTestApp(db: Database): { app: Express; storage: InMemoryObjectStorage } {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl(),
    SESSION_SECRET: 'test-secret-that-is-at-least-32-chars',
    S3_BUCKET: 'test',
  });
  const logger = createLogger(env, 'api-test');
  const storage = new InMemoryObjectStorage();
  const listener = new NotificationListener(env.DATABASE_URL, logger);

  return { app: buildApi(env, { logger, db, storage, listener }), storage };
}
