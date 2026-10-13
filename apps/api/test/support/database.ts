import { existsSync } from 'node:fs';
import { createDatabase, type Database } from '../../src/db/client.js';

const ENV_FILE = new URL('../../../../.env', import.meta.url);
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export function testDatabaseUrl(): string {
  return (
    process.env['TEST_DATABASE_URL'] ?? 'postgresql://intake:intake@localhost:5432/intake_test'
  );
}

export function createTestDatabase(): Database {
  return createDatabase(testDatabaseUrl());
}

export async function resetDatabase(db: Database): Promise<void> {
  await db.$executeRaw`TRUNCATE owners, images, image_check_results CASCADE`;
}
