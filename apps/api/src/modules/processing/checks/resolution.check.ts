import type { OriginalImage } from '../decoding/original-image.js';
import { failed, passed, type CheckResult, type GateCheck } from './check.js';

export class ResolutionCheck implements GateCheck {
  readonly code = 'resolution';

  constructor(private readonly limits: { minShortSide: number; maxPixels: number }) {}

  async run(original: OriginalImage): Promise<CheckResult> {
    const { width, height } = await original.dimensions();
    const { minShortSide, maxPixels } = this.limits;
    const measurement = { width, height, minShortSide, maxPixels };

    if (Math.min(width, height) < minShortSide)
      return failed(this.code, 'resolution_too_low', measurement);
    if (width * height > maxPixels) return failed(this.code, 'resolution_too_high', measurement);
    return passed(this.code, measurement);
  }
}
