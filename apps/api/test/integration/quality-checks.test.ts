import { IMAGE_RULES } from '@image-intake/shared';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { AnalyzedImage } from '../../src/modules/processing/analysis/analyzed-image.js';
import { BlurCheck } from '../../src/modules/processing/checks/blur.check.js';
import { FaceCountCheck } from '../../src/modules/processing/checks/face-count.check.js';
import { FaceSizeCheck } from '../../src/modules/processing/checks/face-size.check.js';
import { ImageDecoder } from '../../src/modules/processing/decoding/image-decoder.js';
import { ImageNormalizer } from '../../src/modules/processing/decoding/normalizer.js';
import { OriginalImage } from '../../src/modules/processing/decoding/original-image.js';
import { FaceApiDetector } from '../../src/modules/processing/faces/face-api-detector.js';
import { DEFAULT_PROCESSING_CONFIG as config } from '../../src/modules/processing/processing-config.js';
import { fixture, noisyImage } from '../support/fixtures.js';

// Runs the real detector against real photos, so this doubles as a check that the
// default thresholds still separate good photos from bad ones.
describe('quality checks on real photos', () => {
  let detector: FaceApiDetector;
  const decoder = new ImageDecoder(IMAGE_RULES.maxPixels);
  const normalizer = new ImageNormalizer(decoder, {
    maxSide: config.normalizedMaxSide,
    thumbnailMaxSide: 400,
  });

  const faceCount = new FaceCountCheck();
  const faceSize = new FaceSizeCheck(config.faceMinAreaRatio);
  const blur = new BlurCheck(config.blurMinVariance);

  beforeAll(async () => {
    detector = await FaceApiDetector.create(config.faceMinConfidence);
  });

  async function analyze(bytes: Buffer): Promise<AnalyzedImage> {
    const normalized = await normalizer.normalize(new OriginalImage(bytes, decoder));
    return new AnalyzedImage(normalized.jpeg, normalized.width, normalized.height, detector);
  }

  async function verdicts(bytes: Buffer) {
    const image = await analyze(bytes);
    const results = await Promise.all([faceCount.run(image), faceSize.run(image), blur.run(image)]);
    return Object.fromEntries(
      results.map((result) => [result.code, result.reason ?? result.outcome]),
    );
  }

  it.each(['single-face.jpg', 'single-face-2.jpg', 'single-face-2.heic'])(
    'passes a sharp single portrait (%s)',
    async (name) => {
      expect(await verdicts(fixture(name))).toEqual({
        face_count: 'passed',
        face_size: 'passed',
        blur: 'passed',
      });
    },
  );

  it('rejects a group photo for multiple faces', async () => {
    expect(await verdicts(fixture('group.jpg'))).toMatchObject({ face_count: 'multiple_faces' });
  });

  it('rejects a blurred portrait', async () => {
    const blurred = await sharp(fixture('single-face.jpg')).blur(3).jpeg().toBuffer();
    expect(await verdicts(blurred)).toMatchObject({ face_count: 'passed', blur: 'blurry' });
  });

  it('rejects a portrait where the face is small in the frame', async () => {
    const portrait = await sharp(fixture('single-face.jpg')).resize(1400).toBuffer();
    const distant = await sharp({
      create: { width: 2400, height: 2400, channels: 3, background: '#8a9' },
    })
      .composite([{ input: portrait, left: 500, top: 300 }])
      .jpeg()
      .toBuffer();
    expect(await verdicts(distant)).toMatchObject({
      face_count: 'passed',
      face_size: 'face_too_small',
    });
  });

  it('rejects a photo with no face and skips the face size check', async () => {
    expect(await verdicts(await noisyImage(800, 800))).toEqual({
      face_count: 'no_face',
      face_size: 'skipped',
      blur: 'passed',
    });
  });
});
