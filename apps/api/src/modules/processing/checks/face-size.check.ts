import type { AnalyzedImage } from '../analysis/analyzed-image.js';
import { failed, passed, skipped, type CheckResult, type QualityCheck } from './check.js';

export class FaceSizeCheck implements QualityCheck {
  readonly code = 'face_size';

  constructor(private readonly minAreaRatio: number) {}

  async run(image: AnalyzedImage): Promise<CheckResult> {
    const face = await image.largestFace();
    if (!face) return skipped(this.code, 'no face detected');

    const areaRatio = (face.box.width * face.box.height) / image.area;
    const measurement = { areaRatio: round(areaRatio), threshold: this.minAreaRatio };

    return areaRatio < this.minAreaRatio
      ? failed(this.code, 'face_too_small', measurement)
      : passed(this.code, measurement);
  }
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
