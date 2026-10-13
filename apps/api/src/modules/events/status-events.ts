import { imageStatusSchema, type ImageStatus } from '@image-intake/shared';
import { z } from 'zod';
import type { DbClient } from '../../db/client.js';

export const IMAGE_STATUS_CHANNEL = 'image_status';
export const IMAGE_PENDING_CHANNEL = 'image_pending';

export interface StatusChange {
  imageId: string;
  ownerId: string;
  status: ImageStatus;
}

const statusChangeSchema = z.object({
  imageId: z.uuid(),
  ownerId: z.uuid(),
  status: imageStatusSchema,
});

/**
 * Must be called inside the transaction that writes the status. Postgres only delivers
 * NOTIFY on commit, so listeners never hear about a change that was rolled back.
 */
export async function publishStatusChange(db: DbClient, change: StatusChange): Promise<void> {
  // $executeRaw rather than $queryRaw: pg_notify returns void, which the client can't deserialize
  await db.$executeRaw`SELECT pg_notify(${IMAGE_STATUS_CHANNEL}, ${JSON.stringify(change)})`;
  if (change.status === 'pending') {
    await db.$executeRaw`SELECT pg_notify(${IMAGE_PENDING_CHANNEL}, ${change.imageId})`;
  }
}

export function parseStatusChange(payload: string): StatusChange | null {
  try {
    const parsed = statusChangeSchema.safeParse(JSON.parse(payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
