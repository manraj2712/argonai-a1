// Prints what each check measures on the fixtures and on generated variants, so threshold
// changes in processing-config.ts can be checked against real numbers.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { IMAGE_RULES } from '@image-intake/shared';
import { AnalyzedImage } from '../src/modules/processing/analysis/analyzed-image.js';
import { laplacianVariance } from '../src/modules/processing/analysis/laplacian.js';
import { differenceHash, hammingDistance } from '../src/modules/processing/analysis/fingerprint.js';
import { ImageDecoder } from '../src/modules/processing/decoding/image-decoder.js';
import { ImageNormalizer } from '../src/modules/processing/decoding/normalizer.js';
import { OriginalImage } from '../src/modules/processing/decoding/original-image.js';
import { FaceApiDetector } from '../src/modules/processing/faces/face-api-detector.js';
import { DEFAULT_PROCESSING_CONFIG as config } from '../src/modules/processing/processing-config.js';

const detector = await FaceApiDetector.create(config.faceMinConfidence);
const decoder = new ImageDecoder(IMAGE_RULES.maxPixels);
const normalizer = new ImageNormalizer(decoder, {
  maxSide: config.normalizedMaxSide,
  thumbnailMaxSide: 400,
});

async function report(label: string, bytes: Buffer) {
  const original = new OriginalImage(bytes, decoder);
  const normalized = await normalizer.normalize(original);
  const image = new AnalyzedImage(normalized.jpeg, normalized.width, normalized.height, detector);
  const faces = await image.faces();
  const largest = faces[0];
  const region = largest ? largest.box : null;
  const sample = await image.greyscale(region, region ? 256 : 1024);
  const whole = await image.greyscale(null, 1024);
  console.log(label.padEnd(24), {
    format: original.format,
    size: `${normalized.width}x${normalized.height}`,
    faces: faces.map((f) => f.score.toFixed(2)).join(','),
    areaRatio: largest ? ((largest.box.width * largest.box.height) / image.area).toFixed(4) : null,
    faceBlur: laplacianVariance(sample.data, sample.width, sample.height).toFixed(1),
    wholeBlur: laplacianVariance(whole.data, whole.width, whole.height).toFixed(1),
  });
  return image.fingerprint();
}

const dir = new URL('../test/fixtures/', import.meta.url);
const single = await readFile(new URL('single-face.jpg', dir));
const single2 = await readFile(new URL('single-face-2.jpg', dir));
const heic = await readFile(new URL('single-face-2.heic', dir));
const group = await readFile(new URL('group.jpg', dir));

const h1 = await report('single-face', single);
const h2 = await report('single-face-2', single2);
const h3 = await report('single-face-2.heic', heic);
await report('group', group);
for (const sigma of [2, 4, 8])
  await report(`single blur σ${sigma}`, await sharp(single).blur(sigma).jpeg().toBuffer());
const small = await sharp({
  create: { width: 2400, height: 2400, channels: 3, background: '#8a9' },
})
  .composite([{ input: await sharp(single).resize(1400).toBuffer(), left: 500, top: 300 }])
  .jpeg()
  .toBuffer();
await report('small face', small);
const nearDup = await sharp(single)
  .resize(900)
  .modulate({ brightness: 1.05 })
  .jpeg({ quality: 70 })
  .toBuffer();
const h4 = await report('near duplicate', nearDup);
const cropped = await sharp(single)
  .extract({ left: 100, top: 100, width: 1000, height: 1300 })
  .jpeg()
  .toBuffer();
const h5 = await report('cropped', cropped);
console.log('distances', {
  'single↔single2': hammingDistance(h1, h2),
  'single2↔heic': hammingDistance(h2, h3),
  'single↔nearDup': hammingDistance(h1, h4),
  'single↔cropped': hammingDistance(h1, h5),
  sanity: hammingDistance(h1, await differenceHash(single)),
});
