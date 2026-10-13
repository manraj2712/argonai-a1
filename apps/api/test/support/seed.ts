import { randomUUID } from 'node:crypto';
import type { ImageStatus } from '@image-intake/shared';
import type { Database } from '../../src/db/client.js';
import { objectKeys } from '../../src/storage/object-keys.js';

export async function createOwner(db: Database): Promise<string> {
  const owner = await db.owner.create({ data: {} });
  return owner.id;
}

export async function createImage(
  db: Database,
  ownerId: string,
  overrides: { status?: ImageStatus; fingerprint?: bigint; createdAt?: Date } = {},
): Promise<string> {
  const id = randomUUID();
  await db.image.create({
    data: {
      id,
      ownerId,
      originalFilename: `${id}.jpg`,
      declaredMimeType: 'image/jpeg',
      declaredSizeBytes: 50_000,
      originalKey: objectKeys.original(ownerId, id),
      status: overrides.status ?? 'pending',
      ...(overrides.fingerprint !== undefined && { fingerprint: overrides.fingerprint }),
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
    },
  });
  return id;
}
