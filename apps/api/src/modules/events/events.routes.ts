import { Router } from 'express';
import { STATUS_EVENT_NAME, type StatusEvent } from '@image-intake/shared';
import { ownerIdOf, requireOwner } from '../../core/http/owner-session.js';
import type { StatusBroadcaster } from './status-broadcaster.js';

// comfortably under the idle timeouts of common proxies and load balancers
const HEARTBEAT_INTERVAL_MS = 25_000;
const CLIENT_RETRY_MS = 3_000;

export function createEventsRouter(broadcaster: StatusBroadcaster): Router {
  const router = Router();

  router.get('/', requireOwner, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: ${CLIENT_RETRY_MS}\n\n`);

    const unsubscribe = broadcaster.subscribe(ownerIdOf(req), ({ imageId, status }) => {
      const event: StatusEvent = { imageId, status };
      res.write(`event: ${STATUS_EVENT_NAME}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}
