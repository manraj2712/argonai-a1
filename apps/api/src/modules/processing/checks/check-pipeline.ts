import type { AnalyzedImage } from '../analysis/analyzed-image.js';
import type { OriginalImage } from '../decoding/original-image.js';
import type { CheckResult, GateCheck, QualityCheck } from './check.js';

export interface GateOutcome {
  passed: boolean;
  results: CheckResult[];
}

export class CheckPipeline {
  constructor(
    private readonly gateChecks: readonly GateCheck[],
    private readonly qualityChecks: readonly QualityCheck[],
  ) {}

  /** Stops at the first failure: later gates assume the earlier ones held. */
  async runGate(original: OriginalImage): Promise<GateOutcome> {
    const results: CheckResult[] = [];
    for (const check of this.gateChecks) {
      const result = await check.run(original);
      results.push(result);
      if (result.outcome === 'failed') return { passed: false, results };
    }
    return { passed: true, results };
  }

  runQuality(image: AnalyzedImage): Promise<CheckResult[]> {
    return Promise.all(this.qualityChecks.map((check) => check.run(image)));
  }
}
