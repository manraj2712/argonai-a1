import { loadEnv } from './config/env.js';
import { buildApi, createInfrastructure } from './container.js';

const env = loadEnv();
const infra = await createInfrastructure(env, 'api');
const { logger, db, listener } = infra;

await listener.start();
const server = buildApi(env, infra).listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  // SSE connections never end on their own
  server.closeAllConnections();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  await listener.stop();
  await db.$disconnect();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
