import sharp from 'sharp';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

/**
 * dHash: shrink to 9x8 greyscale and record whether each pixel is brighter than its right
 * neighbour. Survives re-encoding, resizing and small exposure changes, which is what
 * near-duplicate detection needs.
 *
 * Returned as a signed 64-bit value because that's what fits a Postgres bigint; Hamming
 * distance only looks at the bit pattern so the sign doesn't matter.
 */
export async function differenceHash(image: Buffer): Promise<bigint> {
  const pixels = await sharp(image)
    .greyscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .raw()
    .toBuffer();

  let hash = 0n;
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let column = 0; column < HASH_WIDTH - 1; column++) {
      const index = row * HASH_WIDTH + column;
      const brighter = (pixels[index] ?? 0) > (pixels[index + 1] ?? 0);
      hash = (hash << 1n) | (brighter ? 1n : 0n);
    }
  }
  return BigInt.asIntN(64, hash);
}

export function hammingDistance(a: bigint, b: bigint): number {
  let difference = BigInt.asUintN(64, a ^ b);
  let distance = 0;
  while (difference > 0n) {
    distance += Number(difference & 1n);
    difference >>= 1n;
  }
  return distance;
}
