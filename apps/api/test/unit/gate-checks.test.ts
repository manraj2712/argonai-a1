import { IMAGE_RULES } from '@image-intake/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FileSizeCheck } from '../../src/modules/processing/checks/file-size.check.js';
import { FormatCheck } from '../../src/modules/processing/checks/format.check.js';
import { ResolutionCheck } from '../../src/modules/processing/checks/resolution.check.js';
import { ImageDecoder } from '../../src/modules/processing/decoding/image-decoder.js';
import { OriginalImage } from '../../src/modules/processing/decoding/original-image.js';
import { GIF_BYTES, fixture, noisyImage } from '../support/fixtures.js';

const decoder = new ImageDecoder(IMAGE_RULES.maxPixels);
const original = (bytes: Buffer) => new OriginalImage(bytes, decoder);

describe('FileSizeCheck', () => {
  const check = new FileSizeCheck({ min: 100, max: 1000 });

  it.each([
    [99, 'failed', 'file_too_small'],
    [100, 'passed', null],
    [1000, 'passed', null],
    [1001, 'failed', 'file_too_large'],
  ] as const)('%i bytes → %s', async (size, outcome, reason) => {
    const result = await check.run(original(Buffer.alloc(size)));
    expect(result).toMatchObject({ outcome, reason });
  });
});

describe('FormatCheck', () => {
  const check = new FormatCheck();

  it.each([
    ['single-face.jpg', 'jpeg'],
    ['single-face-2.heic', 'heic'],
  ])('accepts %s as %s', async (name, format) => {
    expect(await check.run(original(fixture(name)))).toMatchObject({
      outcome: 'passed',
      measurement: { detected: format },
    });
  });

  it('accepts PNG', async () => {
    const png = await sharp(fixture('single-face.jpg')).png().toBuffer();
    expect(await check.run(original(png))).toMatchObject({
      outcome: 'passed',
      measurement: { detected: 'png' },
    });
  });

  it('rejects a GIF whatever it was called', async () => {
    expect(await check.run(original(GIF_BYTES))).toMatchObject({
      outcome: 'failed',
      reason: 'unsupported_format',
    });
  });

  it('rejects a file with a JPEG signature but a corrupt header', async () => {
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(4096, 0x41),
    ]);
    expect(await check.run(original(corrupt))).toMatchObject({
      outcome: 'failed',
      reason: 'unreadable_image',
    });
  });
});

describe('ResolutionCheck', () => {
  const check = new ResolutionCheck({ minShortSide: 512, maxPixels: 1_000_000 });

  it('rejects an image whose short side is under the minimum', async () => {
    const result = await check.run(original(await noisyImage(800, 400)));
    expect(result).toMatchObject({
      outcome: 'failed',
      reason: 'resolution_too_low',
      measurement: { width: 800, height: 400 },
    });
  });

  it('rejects an image over the pixel limit without decoding it', async () => {
    const huge = await sharp({
      create: { width: 2000, height: 2000, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    expect(await check.run(original(huge))).toMatchObject({
      outcome: 'failed',
      reason: 'resolution_too_high',
    });
  });

  it('passes an image within both limits', async () => {
    expect(await check.run(original(await noisyImage(600, 800)))).toMatchObject({
      outcome: 'passed',
    });
  });
});
