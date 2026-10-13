import type { CookieOptions, Request, RequestHandler } from 'express';
import { z } from 'zod';
import { UnauthorizedError } from '../errors.js';

export const OWNER_COOKIE = 'owner_id';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ownerIdSchema = z.uuid();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express only exposes Request for augmentation this way
  namespace Express {
    interface Request {
      ownerId?: string;
    }
  }
}

export function ownerCookieOptions(secure: boolean): CookieOptions {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure, maxAge: ONE_YEAR_MS, path: '/' };
}

/** Returns the owner id from the signed cookie, or null when it's missing or tampered with. */
export function readOwnerCookie(req: Request): string | null {
  const signedCookies = req.signedCookies as Record<string, unknown>;
  const parsed = ownerIdSchema.safeParse(signedCookies[OWNER_COOKIE]);
  return parsed.success ? parsed.data : null;
}

export const requireOwner: RequestHandler = (req, _res, next) => {
  const ownerId = readOwnerCookie(req);
  if (!ownerId) {
    next(new UnauthorizedError());
    return;
  }
  req.ownerId = ownerId;
  next();
};

export function ownerIdOf(req: Request): string {
  if (!req.ownerId) throw new UnauthorizedError();
  return req.ownerId;
}
