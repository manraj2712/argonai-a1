import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildProcessor } from '../../src/container.js';
import { createLogger } from '../../src/core/logger.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../src/modules/processing/processing-config.js';
import { objectKeys } from '../../src/storage/object-keys.js';
import { createTestDatabase, resetDatabase } from '../support/database.js';
import { CentredFaceDetector } from '../support/fake-face-detector.js';
import { GIF_BYTES, fixture, noisyImage } from '../support/fixtures.js';
import { InMemoryObjectStorage } from '../support/in-memory-object-storage.js';
import { createImage, createOwner } from '../support/seed.js';

const db = createTestDatabase();
const storage = new InMemoryObjectStorage();
const logger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' }, 'processor-test');
const { processor, queue } = buildProcessor(
  { db, storage, logger },
  DEFAULT_PROCESSING_CONFIG,
  new CentredFaceDetector(),
);

afterAll(() => db.$disconnect());
beforeEach(async () => {
  await resetDatabase(db);
  storage.objects.clear();
});

async function upload(ownerId: string, bytes: Buffer): Promise<string> {
  const id = await createImage(db, ownerId);
  await storage.put(objectKeys.original(ownerId, id), bytes, 'application/octet-stream');
  return id;
}

async function processNext() {
  const claimed = await queue.claim();
  if (!claimed) throw new Error('nothing to claim');
  return processor.process(claimed);
}

async function reasonsFor(id: string) {
  const results = await db.imageCheckResult.findMany({ where: { imageId: id, outcome: 'failed' } });
  return results.map((result) => result.reason);
}

// The face detector is faked here so these tests are about the pipeline's plumbing;
// the real detector is covered in quality-checks.test.ts.
describe('ImageProcessor', () => {
  it('accepts a good photo, stores renditions and drops the original', async () => {
    const ownerId = await createOwner(db);
    const id = await upload(ownerId, fixture('single-face.jpg'));

    expect(await processNext()).toBe('accepted');

    const image = await db.image.findUniqueOrThrow({ where: { id } });
    expect(image).toMatchObject({ status: 'accepted', format: 'jpeg', width: 1280, height: 1600 });
    expect(image.fingerprint).not.toBeNull();
    expect(storage.objects.get(objectKeys.normalized(ownerId, id))?.contentType).toBe('image/jpeg');
    expect(storage.objects.get(objectKeys.thumbnail(ownerId, id))?.contentType).toBe('image/webp');
    expect(storage.objects.has(objectKeys.original(ownerId, id))).toBe(false);
  });

  it('converts HEIC into a normalized JPEG', async () => {
    const ownerId = await createOwner(db);
    const id = await upload(ownerId, fixture('single-face-2.heic'));

    expect(await processNext()).toBe('accepted');

    const normalized = storage.objects.get(objectKeys.normalized(ownerId, id));
    expect(await sharp(normalized?.body).metadata()).toMatchObject({ format: 'jpeg', width: 1280 });
    expect((await db.image.findUniqueOrThrow({ where: { id } })).format).toBe('heic');
  });

  it('rejects an unsupported format without examining it further', async () => {
    const id = await upload(await createOwner(db), GIF_BYTES);

    expect(await processNext()).toBe('rejected');
    expect(await reasonsFor(id)).toEqual(['unsupported_format']);
    expect((await db.image.findUniqueOrThrow({ where: { id } })).thumbnailKey).toBeNull();
  });

  it('still makes a thumbnail for an image rejected at the gate', async () => {
    const ownerId = await createOwner(db);
    const id = await upload(ownerId, await noisyImage(400, 300));

    expect(await processNext()).toBe('rejected');
    expect(await reasonsFor(id)).toEqual(['resolution_too_low']);
    expect(storage.objects.has(objectKeys.thumbnail(ownerId, id))).toBe(true);
  });

  it('collects every quality failure at once', async () => {
    const blurred = await sharp(fixture('single-face.jpg')).blur(6).jpeg().toBuffer();
    const id = await upload(await createOwner(db), blurred);
    await processNext();

    expect(await reasonsFor(id)).toContain('blurry');
  });

  it('rejects a near-duplicate of an image the owner already has', async () => {
    const ownerId = await createOwner(db);
    await upload(ownerId, fixture('single-face.jpg'));
    await processNext();

    const reworked = await sharp(fixture('single-face.jpg'))
      .resize(1000)
      .jpeg({ quality: 70 })
      .toBuffer();
    const duplicate = await upload(ownerId, reworked);

    expect(await processNext()).toBe('rejected');
    expect(await reasonsFor(duplicate)).toEqual(['too_similar']);
  });

  it('rejects a truncated file that only looks valid from its header', async () => {
    const jpeg = fixture('single-face.jpg');
    const id = await upload(await createOwner(db), jpeg.subarray(0, Math.floor(jpeg.length / 3)));

    expect(await processNext()).toBe('rejected');
    expect(await reasonsFor(id)).toEqual(['unreadable_image']);
  });

  it('cleans up everything it wrote when the image was deleted mid-way', async () => {
    const ownerId = await createOwner(db);
    const id = await upload(ownerId, fixture('single-face.jpg'));
    const claimed = await queue.claim();
    if (!claimed) throw new Error('nothing to claim');
    await db.image.delete({ where: { id } });

    expect(await processor.process(claimed)).toBe('deleted');
    expect(storage.objects.size).toBe(0);
  });
});
