import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  differenceHash,
  hammingDistance,
} from '../../src/modules/processing/analysis/fingerprint.js';
import { fixture } from '../support/fixtures.js';

describe('differenceHash', () => {
  const portrait = fixture('single-face.jpg');

  it('is stable for the same image', async () => {
    expect(await differenceHash(portrait)).toBe(await differenceHash(portrait));
  });

  it('barely moves when the image is resized, re-encoded and brightened', async () => {
    const reworked = await sharp(portrait)
      .resize(700)
      .modulate({ brightness: 1.05 })
      .jpeg({ quality: 60 })
      .toBuffer();
    expect(
      hammingDistance(await differenceHash(portrait), await differenceHash(reworked)),
    ).toBeLessThanOrEqual(3);
  });

  it('is far apart for different photos', async () => {
    const other = fixture('single-face-2.jpg');
    expect(
      hammingDistance(await differenceHash(portrait), await differenceHash(other)),
    ).toBeGreaterThan(10);
  });

  it('fits in a signed 64-bit integer', async () => {
    const hash = await differenceHash(portrait);
    expect(hash).toBe(BigInt.asIntN(64, hash));
  });
});

describe('hammingDistance', () => {
  it('counts differing bits across the sign bit', () => {
    expect(hammingDistance(0n, -1n)).toBe(64);
    expect(hammingDistance(0b1010n, 0b0110n)).toBe(2);
  });
});
