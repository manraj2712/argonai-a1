import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler, type Router } from 'express';
import helmet from 'helmet';
import { createErrorHandler, notFoundHandler } from './core/http/error-handler.js';
import type { Logger } from './core/logger.js';

export interface AppDeps {
  logger: Logger;
  sessionSecret: string;
  routes: {
    health: RequestHandler;
    sessions: Router;
    images: Router;
    events: Router;
  };
}

export function createApp({ logger, sessionSecret, routes }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  // behind exactly one proxy (vite in dev, nginx in compose); rate limiting needs the client IP
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(sessionSecret));

  app.get('/api/health', routes.health);
  app.use('/api/sessions', routes.sessions);
  // mounted before /api/images so "events" isn't parsed as an image id
  app.use('/api/images/events', routes.events);
  app.use('/api/images', routes.images);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
