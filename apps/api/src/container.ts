import { IMAGE_RULES } from '@image-intake/shared';
import type { Express, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createApp } from './app.js';
import type { Env } from './config/env.js';
import { createLogger, type Logger } from './core/logger.js';
import { createDatabase, type Database } from './db/client.js';
import { NotificationListener } from './db/notification-listener.js';
import { createEventsRouter } from './modules/events/events.routes.js';
import { StatusBroadcaster } from './modules/events/status-broadcaster.js';
import { ImagesController } from './modules/images/images.controller.js';
import { ImagesRepository } from './modules/images/images.repository.js';
import { createImagesRouter } from './modules/images/images.routes.js';
import { ImagesService } from './modules/images/images.service.js';
import { BlurCheck } from './modules/processing/checks/blur.check.js';
import { CheckPipeline } from './modules/processing/checks/check-pipeline.js';
import { FaceCountCheck } from './modules/processing/checks/face-count.check.js';
import { FaceSizeCheck } from './modules/processing/checks/face-size.check.js';
import { FileSizeCheck } from './modules/processing/checks/file-size.check.js';
import { FormatCheck } from './modules/processing/checks/format.check.js';
import { ResolutionCheck } from './modules/processing/checks/resolution.check.js';
import { ImageDecoder } from './modules/processing/decoding/image-decoder.js';
import { ImageNormalizer } from './modules/processing/decoding/normalizer.js';
import { FaceApiDetector } from './modules/processing/faces/face-api-detector.js';
import type { FaceDetector } from './modules/processing/faces/face-detector.js';
import { ImageFinalizer } from './modules/processing/image-finalizer.js';
import { ImageProcessor } from './modules/processing/image-processor.js';
import { JobQueue } from './modules/processing/job-queue.js';
import {
  processingConfigFromEnv,
  type ProcessingConfig,
} from './modules/processing/processing-config.js';
import { ProcessingWorker } from './modules/processing/processing-worker.js';
import { createSessionsRouter } from './modules/sessions/sessions.routes.js';
import { OwnersRepository } from './modules/sessions/owners.repository.js';
import type { ObjectStorage } from './storage/object-storage.js';
import { S3ObjectStorage } from './storage/s3-object-storage.js';

export interface Infrastructure {
  logger: Logger;
  db: Database;
  storage: ObjectStorage;
  listener: NotificationListener;
}

export async function createInfrastructure(env: Env, name: string): Promise<Infrastructure> {
  const logger = createLogger(env, name);
  const storage = new S3ObjectStorage({
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
  if (env.S3_CREATE_BUCKET) await storage.ensureBucket();

  return {
    logger,
    db: createDatabase(env.DATABASE_URL),
    storage,
    listener: new NotificationListener(env.DATABASE_URL, logger),
  };
}

function limiter(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
}

export function buildApi(env: Env, infra: Infrastructure): Express {
  const { logger, db, storage, listener } = infra;
  const images = new ImagesRepository();
  const service = new ImagesService({ db, images, storage, logger });

  return createApp({
    logger,
    sessionSecret: env.SESSION_SECRET,
    routes: {
      health: async (_req, res) => {
        await db.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
      },
      sessions: createSessionsRouter({
        db,
        owners: new OwnersRepository(),
        secureCookies: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
        rateLimit: limiter(30),
      }),
      images: createImagesRouter(new ImagesController(service), limiter(60)),
      events: createEventsRouter(new StatusBroadcaster(listener, logger)),
    },
  });
}

export function buildCheckPipeline(config: ProcessingConfig): CheckPipeline {
  return new CheckPipeline(
    [
      new FileSizeCheck(IMAGE_RULES.bytes),
      new FormatCheck(),
      new ResolutionCheck({
        minShortSide: IMAGE_RULES.minShortSide,
        maxPixels: IMAGE_RULES.maxPixels,
      }),
    ],
    [
      new FaceCountCheck(),
      new FaceSizeCheck(config.faceMinAreaRatio),
      new BlurCheck(config.blurMinVariance),
    ],
  );
}

export function buildProcessor(
  infra: Pick<Infrastructure, 'db' | 'storage' | 'logger'>,
  config: ProcessingConfig,
  faceDetector: FaceDetector,
): { processor: ImageProcessor; queue: JobQueue } {
  const { db, storage, logger } = infra;
  const images = new ImagesRepository();
  const decoder = new ImageDecoder(IMAGE_RULES.maxPixels);

  return {
    queue: new JobQueue(db, images, config),
    processor: new ImageProcessor({
      storage,
      decoder,
      normalizer: new ImageNormalizer(decoder, {
        maxSide: config.normalizedMaxSide,
        thumbnailMaxSide: config.thumbnailMaxSide,
      }),
      pipeline: buildCheckPipeline(config),
      faceDetector,
      finalizer: new ImageFinalizer(db, images, config.similarityMaxDistance),
      logger,
    }),
  };
}

export async function buildWorker(env: Env, infra: Infrastructure): Promise<ProcessingWorker> {
  const config = processingConfigFromEnv(env);
  const faceDetector = await FaceApiDetector.create(config.faceMinConfidence);
  const { processor, queue } = buildProcessor(infra, config, faceDetector);

  return new ProcessingWorker({
    queue,
    processor,
    listener: infra.listener,
    storage: infra.storage,
    logger: infra.logger,
    config,
  });
}
