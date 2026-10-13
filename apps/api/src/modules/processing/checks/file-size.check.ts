import type { OriginalImage } from '../decoding/original-image.js';
import { failed, passed, type CheckResult, type GateCheck } from './check.js';

export class FileSizeCheck implements GateCheck {
  readonly code = 'file_size';

  constructor(private readonly limits: { min: number; max: number }) {}

  run(original: OriginalImage): Promise<CheckResult> {
    const { min, max } = this.limits;
    const measurement = { sizeBytes: original.sizeBytes, min, max };

    if (original.sizeBytes < min)
      return Promise.resolve(failed(this.code, 'file_too_small', measurement));
    if (original.sizeBytes > max)
      return Promise.resolve(failed(this.code, 'file_too_large', measurement));
    return Promise.resolve(passed(this.code, measurement));
  }
}
