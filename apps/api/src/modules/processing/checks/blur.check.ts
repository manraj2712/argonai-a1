import type { AnalyzedImage } from '../analysis/analyzed-image.js';
import { laplacianVariance } from '../analysis/laplacian.js';
import type { FaceBox } from '../faces/face-detector.js';
import { failed, passed, type CheckResult, type QualityCheck } from './check.js';

const FACE_PADDING = 0.15;
const FACE_SAMPLE_SIDE = 256;
const IMAGE_SAMPLE_SIDE = 1024;

/**
 * Measures sharpness on the face rather than the whole frame. Portrait-mode photos blur the
 * background on purpose, and judging those by the whole frame would reject the best shots.
 */
export class BlurCheck implements QualityCheck {
  readonly code = 'blur';

  constructor(private readonly minVariance: number) {}

  async run(image: AnalyzedImage): Promise<CheckResult> {
    const face = await image.largestFace();
    const region = face ? pad(face.box, image.width, image.height) : null;
    const sample = await image.greyscale(region, region ? FACE_SAMPLE_SIDE : IMAGE_SAMPLE_SIDE);

    const variance = laplacianVariance(sample.data, sample.width, sample.height);
    const measurement = {
      laplacianVariance: Math.round(variance * 10) / 10,
      threshold: this.minVariance,
      region: region ? 'face' : 'image',
    };

    return variance < this.minVariance
      ? failed(this.code, 'blurry', measurement)
      : passed(this.code, measurement);
  }
}

function pad(box: FaceBox, imageWidth: number, imageHeight: number): FaceBox {
  const padX = box.width * FACE_PADDING;
  const padY = box.height * FACE_PADDING;
  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  return {
    x,
    y,
    width: Math.min(imageWidth - x, box.width + 2 * padX),
    height: Math.min(imageHeight - y, box.height + 2 * padY),
  };
}
