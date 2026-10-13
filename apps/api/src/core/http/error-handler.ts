import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ProblemDetails } from '@image-intake/shared';
import { AppError, NotFoundError } from '../errors.js';
import type { Logger } from '../logger.js';

function toProblem(error: AppError): ProblemDetails {
  return {
    type: 'about:blank',
    title: error.message,
    status: error.status,
    code: error.code,
    ...(error.issues && { issues: error.issues }),
  };
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route'));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    // body-parser errors (malformed JSON, payload too large) carry their own status
    const appError =
      error instanceof AppError
        ? error
        : isHttpError(error)
          ? new AppError(error.message, error.status, error.type ?? 'bad_request')
          : null;

    if (!appError) {
      logger.error({ err: error, method: req.method, url: req.originalUrl }, 'unhandled error');
      res.status(500).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Internal server error',
        status: 500,
        code: 'internal',
      });
      return;
    }

    res.status(appError.status).type('application/problem+json').json(toProblem(appError));
  };
}

function isHttpError(error: unknown): error is { status: number; message: string; type?: string } {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}
