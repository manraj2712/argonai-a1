import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ImagesRepository } from '../../src/modules/images/images.repository.js';
import { JobQueue } from '../../src/modules/processing/job-queue.js';
import { createTestDatabase, resetDatabase } from '../support/database.js';
import { createImage, createOwner } from '../support/seed.js';

const db = createTestDatabase();
const queue = new JobQueue(db, new ImagesRepository(), {
  leaseSeconds: 60,
  maxAttempts: 2,
  abandonedUploadMinutes: 60,
});

afterAll(() => db.$disconnect());
beforeEach(() => resetDatabase(db));

describe('JobQueue', () => {
  it('never hands the same image to two workers', async () => {
    const ownerId = await createOwner(db);
    const ids = await Promise.all(Array.from({ length: 5 }, () => createImage(db, ownerId)));

    const claims = await Promise.all(Array.from({ length: 8 }, () => queue.claim()));
    const claimedIds = claims.flatMap((claim) => (claim ? [claim.id] : []));

    expect(claimedIds.sort()).toEqual([...ids].sort());
    expect(claims.filter((claim) => claim === null)).toHaveLength(3);
  });

  it('claims the oldest pending image first', async () => {
    const ownerId = await createOwner(db);
    await createImage(db, ownerId, { createdAt: new Date('2026-01-02') });
    const oldest = await createImage(db, ownerId, { createdAt: new Date('2026-01-01') });

    expect((await queue.claim())?.id).toBe(oldest);
  });

  it('ignores images that are not pending', async () => {
    const ownerId = await createOwner(db);
    await createImage(db, ownerId, { status: 'awaiting_upload' });
    await createImage(db, ownerId, { status: 'accepted' });

    expect(await queue.claim()).toBeNull();
  });

  it('puts a released image back, then fails it once attempts run out', async () => {
    const ownerId = await createOwner(db);
    const id = await createImage(db, ownerId);

    const first = await queue.claim();
    if (!first) throw new Error('expected a claim');
    await queue.release(first, new Error('storage timeout'));
    expect(await db.image.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'pending',
      attempts: 1,
    });

    const second = await queue.claim();
    if (!second) throw new Error('expected a claim');
    await queue.release(second, new Error('storage timeout'));
    expect(await db.image.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'failed',
      attempts: 2,
      lastError: 'storage timeout',
    });
  });

  it('reclaims an image whose worker let its lease expire', async () => {
    const ownerId = await createOwner(db);
    const id = await createImage(db, ownerId);
    await queue.claim();
    await db.image.update({ where: { id }, data: { lockedAt: new Date(Date.now() - 120_000) } });

    expect((await queue.claim())?.id).toBe(id);
  });

  it('sweeps abandoned upload slots and returns their keys', async () => {
    const ownerId = await createOwner(db);
    const stale = await createImage(db, ownerId, {
      status: 'awaiting_upload',
      createdAt: new Date(Date.now() - 2 * 3_600_000),
    });
    const fresh = await createImage(db, ownerId, { status: 'awaiting_upload' });

    const { abandonedKeys } = await queue.sweep();

    expect(abandonedKeys).toEqual([`originals/${ownerId}/${stale}`]);
    expect(await db.image.count({ where: { id: stale } })).toBe(0);
    expect(await db.image.count({ where: { id: fresh } })).toBe(1);
  });
});
