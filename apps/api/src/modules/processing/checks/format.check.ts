import { UnreadableImageError } from '../decoding/image-decoder.js';
import type { OriginalImage } from '../decoding/original-image.js';
import { failed, passed, type CheckResult, type GateCheck } from './check.js';

/** Trusts only the magic bytes, then confirms the header actually parses. */
export class FormatCheck implements GateCheck {
  readonly code = 'format';

  async run(original: OriginalImage): Promise<CheckResult> {
    if (!original.format) return failed(this.code, 'unsupported_format', { detected: null });

    try {
      await original.dimensions();
    } catch (error) {
      if (error instanceof UnreadableImageError) {
        return failed(this.code, 'unreadable_image', { detected: original.format });
      }
      throw error;
    }
    return passed(this.code, { detected: original.format });
  }
}
