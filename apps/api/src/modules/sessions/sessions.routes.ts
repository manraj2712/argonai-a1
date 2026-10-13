import { Router, type RequestHandler } from 'express';
import type { SessionResponse } from '@image-intake/shared';
import {
  OWNER_COOKIE,
  ownerCookieOptions,
  readOwnerCookie,
} from '../../core/http/owner-session.js';
import type { Database } from '../../db/client.js';
import type { OwnersRepository } from './owners.repository.js';

export interface SessionsRouterDeps {
  db: Database;
  owners: OwnersRepository;
  secureCookies: boolean;
  rateLimit: RequestHandler;
}

export function createSessionsRouter({
  db,
  owners,
  secureCookies,
  rateLimit,
}: SessionsRouterDeps): Router {
  const router = Router();

  router.post('/', rateLimit, async (req, res) => {
    const ownerId = await owners.ensure(db, readOwnerCookie(req));
    res.cookie(OWNER_COOKIE, ownerId, ownerCookieOptions(secureCookies));
    res.json({ ownerId } satisfies SessionResponse);
  });

  return router;
}
