import { describe, expect, it } from 'vitest';
import { laplacianVariance } from '../../src/modules/processing/analysis/laplacian.js';

function image(width: number, height: number, pixel: (x: number, y: number) => number): Uint8Array {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[y * width + x] = pixel(x, y);
  return data;
}

describe('laplacianVariance', () => {
  it('is zero for a flat image', () => {
    expect(
      laplacianVariance(
        image(16, 16, () => 128),
        16,
        16,
      ),
    ).toBe(0);
  });

  it('is zero for a linear gradient, which has no second derivative', () => {
    expect(
      laplacianVariance(
        image(16, 16, (x) => x * 10),
        16,
        16,
      ),
    ).toBe(0);
  });

  it('is large for a checkerboard', () => {
    const checkerboard = image(16, 16, (x, y) => ((x + y) % 2 === 0 ? 0 : 255));
    expect(laplacianVariance(checkerboard, 16, 16)).toBeGreaterThan(10_000);
  });

  it('returns zero for images too small to have an interior', () => {
    expect(laplacianVariance(new Uint8Array(4), 2, 2)).toBe(0);
  });
});
