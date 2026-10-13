import { loadEnv } from './config/env.js';
import { buildWorker, createInfrastructure } from './container.js';

const SHUTDOWN_TIMEOUT_MS = 30_000;

const env = loadEnv();
const infra = await createInfrastructure(env, 'worker');
const { logger, db, listener } = infra;

await listener.start();
const worker = await buildWorker(env, infra);
worker.start();
logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'worker started');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'finishing in-flight images');
  // anything still running when we give up is reclaimed once its lease expires
  const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  await worker.stop();
  await listener.stop();
  await db.$disconnect();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
