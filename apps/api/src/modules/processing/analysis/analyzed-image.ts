import sharp from 'sharp';
import type { DetectedFace, FaceBox, FaceDetector } from '../faces/face-detector.js';
import { differenceHash } from './fingerprint.js';

export interface GreyscaleSample {
  data: Uint8Array;
  width: number;
  height: number;
}

// SSD MobileNet resizes its input to 512px anyway; detecting on a smaller copy is much
// cheaper and loses nothing.
const DETECTION_MAX_SIDE = 1024;

/**
 * The normalized image plus the expensive things derived from it. Each derivation runs at
 * most once, so several checks can ask for faces without running detection again.
 */
export class AnalyzedImage {
  private facesPromise: Promise<DetectedFace[]> | null = null;
  private fingerprintPromise: Promise<bigint> | null = null;

  constructor(
    readonly jpeg: Buffer,
    readonly width: number,
    readonly height: number,
    private readonly faceDetector: FaceDetector,
  ) {}

  get area(): number {
    return this.width * this.height;
  }

  /** Faces in this image's own pixel coordinates, largest first. */
  faces(): Promise<DetectedFace[]> {
    this.facesPromise ??= this.detectFaces();
    return this.facesPromise;
  }

  async largestFace(): Promise<DetectedFace | null> {
    return (await this.faces())[0] ?? null;
  }

  fingerprint(): Promise<bigint> {
    this.fingerprintPromise ??= differenceHash(this.jpeg);
    return this.fingerprintPromise;
  }

  async greyscale(region: FaceBox | null, maxSide: number): Promise<GreyscaleSample> {
    let pipeline = sharp(this.jpeg);
    if (region) {
      pipeline = pipeline.extract({
        left: Math.round(region.x),
        top: Math.round(region.y),
        width: Math.max(1, Math.round(region.width)),
        height: Math.max(1, Math.round(region.height)),
      });
    }
    const { data, info } = await pipeline
      .greyscale()
      .resize({ width: maxSide, height: maxSide, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }

  private async detectFaces(): Promise<DetectedFace[]> {
    const { data, info } = await sharp(this.jpeg)
      .resize({
        width: DETECTION_MAX_SIDE,
        height: DETECTION_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const scale = this.width / info.width;
    const faces = await this.faceDetector.detect({ data, width: info.width, height: info.height });

    return faces
      .map((face) => ({
        score: face.score,
        box: {
          x: face.box.x * scale,
          y: face.box.y * scale,
          width: face.box.width * scale,
          height: face.box.height * scale,
        },
      }))
      .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  }
}
