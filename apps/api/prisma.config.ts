import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The CLI doesn't read .env on its own since Prisma 7; the app gets it from `--env-file`.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
