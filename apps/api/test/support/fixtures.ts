import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const FIXTURES = new URL('../fixtures/', import.meta.url);

export function fixture(name: string): Buffer {
  return readFileSync(new URL(name, FIXTURES));
}

/** Smooth gradients would read as blurry, so the generated photo gets noise for texture. */
export function noisyImage(width: number, height: number, seed = 1): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  let state = seed;
  for (let i = 0; i < pixels.length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    pixels[i] = state & 0xff;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export const GIF_BYTES = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20 * 1024)]);
