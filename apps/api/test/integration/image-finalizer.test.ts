import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ImagesRepository } from '../../src/modules/images/images.repository.js';
import { passed } from '../../src/modules/processing/checks/check.js';
import {
  ImageFinalizer,
  type FinalizeInput,
} from '../../src/modules/processing/image-finalizer.js';
import type { ClaimedImage } from '../../src/modules/processing/job-queue.js';
import { createTestDatabase, resetDatabase } from '../support/database.js';
import { createImage, createOwner } from '../support/seed.js';

const db = createTestDatabase();
const finalizer = new ImageFinalizer(db, new ImagesRepository(), 6);

afterAll(() => db.$disconnect());
beforeEach(() => resetDatabase(db));

async function processingImage(ownerId: string): Promise<ClaimedImage> {
  const id = await createImage(db, ownerId, { status: 'processing' });
  return { id, ownerId, originalKey: `originals/${ownerId}/${id}`, attempts: 1 };
}

function input(image: ClaimedImage, fingerprint: bigint): FinalizeInput {
  return {
    image,
    results: [passed('file_size'), passed('format'), passed('resolution')],
    fingerprint,
    sizeBytes: 50_000,
    format: 'jpeg',
    width: 1000,
    height: 1200,
    normalizedKey: `normalized/${image.id}.jpg`,
    thumbnailKey: `thumbnails/${image.id}.webp`,
  };
}

describe('ImageFinalizer', () => {
  it('rejects an image that is a near-duplicate of an accepted one', async () => {
    const ownerId = await createOwner(db);
    await createImage(db, ownerId, { status: 'accepted', fingerprint: 0b1111n });
    const image = await processingImage(ownerId);

    expect(await finalizer.finalize(input(image, 0b0111n))).toBe('rejected');

    const results = await db.imageCheckResult.findMany({ where: { imageId: image.id } });
    expect(results.find((result) => result.checkCode === 'similarity')).toMatchObject({
      outcome: 'failed',
      reason: 'too_similar',
      measurement: { distance: 1, threshold: 6 },
    });
  });

  it("doesn't compare against other owners' images", async () => {
    const someoneElse = await createOwner(db);
    await createImage(db, someoneElse, { status: 'accepted', fingerprint: 42n });
    const image = await processingImage(await createOwner(db));

    expect(await finalizer.finalize(input(image, 42n))).toBe('accepted');
  });

  it('accepts only one of two near-duplicates finalized at the same moment', async () => {
    const ownerId = await createOwner(db);
    const [first, second] = await Promise.all([processingImage(ownerId), processingImage(ownerId)]);

    const outcomes = await Promise.all([
      finalizer.finalize(input(first, 1000n)),
      finalizer.finalize(input(second, 1001n)),
    ]);

    expect(outcomes.sort()).toEqual(['accepted', 'rejected']);
  });

  it('writes status, results and measurements together', async () => {
    const image = await processingImage(await createOwner(db));

    await finalizer.finalize(input(image, 7n));

    const stored = await db.image.findUniqueOrThrow({
      where: { id: image.id },
      include: { checkResults: true },
    });
    expect(stored).toMatchObject({
      status: 'accepted',
      fingerprint: 7n,
      width: 1000,
      lockedAt: null,
    });
    expect(stored.processedAt).toBeInstanceOf(Date);
    expect(stored.checkResults).toHaveLength(4);
  });

  it('reports an image deleted mid-processing without writing anything', async () => {
    const image = await processingImage(await createOwner(db));
    await db.image.delete({ where: { id: image.id } });

    expect(await finalizer.finalize(input(image, 7n))).toBe('deleted');
    expect(await db.imageCheckResult.count()).toBe(0);
  });

  it('reports an image another worker already finished', async () => {
    const image = await processingImage(await createOwner(db));
    await finalizer.finalize(input(image, 7n));

    expect(await finalizer.finalize(input(image, 7n))).toBe('superseded');
  });
});
