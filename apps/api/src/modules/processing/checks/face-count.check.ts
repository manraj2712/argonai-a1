import type { AnalyzedImage } from '../analysis/analyzed-image.js';
import { failed, passed, type CheckResult, type QualityCheck } from './check.js';

export class FaceCountCheck implements QualityCheck {
  readonly code = 'face_count';

  async run(image: AnalyzedImage): Promise<CheckResult> {
    const faces = await image.faces();
    const measurement = { faceCount: faces.length };

    if (faces.length === 0) return failed(this.code, 'no_face', measurement);
    if (faces.length > 1) return failed(this.code, 'multiple_faces', measurement);
    return passed(this.code, measurement);
  }
}
