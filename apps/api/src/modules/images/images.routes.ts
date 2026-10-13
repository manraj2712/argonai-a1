import { Router, type RequestHandler } from 'express';
import { requireOwner } from '../../core/http/owner-session.js';
import type { ImagesController } from './images.controller.js';

export function createImagesRouter(
  controller: ImagesController,
  uploadRateLimit: RequestHandler,
): Router {
  const router = Router();
  router.use(requireOwner);

  router.post('/', uploadRateLimit, controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/:id/complete', controller.complete);
  router.delete('/:id', controller.remove);

  return router;
}
