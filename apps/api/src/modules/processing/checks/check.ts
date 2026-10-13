import type { CheckCode, CheckOutcome, RejectionReason } from '@image-intake/shared';
import type { AnalyzedImage } from '../analysis/analyzed-image.js';
import type { OriginalImage } from '../decoding/original-image.js';

export type Measurement = Record<string, string | number | boolean | null>;

export interface CheckResult {
  code: CheckCode;
  outcome: CheckOutcome;
  reason: RejectionReason | null;
  measurement: Measurement;
}

/**
 * Must pass before anything else can meaningfully run. The pipeline stops at the first
 * gate failure.
 */
export interface GateCheck {
  readonly code: CheckCode;
  run(original: OriginalImage): Promise<CheckResult>;
}

/** Runs on the normalized image. Every quality check runs, so the owner sees every problem at once. */
export interface QualityCheck {
  readonly code: CheckCode;
  run(image: AnalyzedImage): Promise<CheckResult>;
}

// A bad image is a result, not an exception. Checks throw only when something on our side broke.
export function passed(code: CheckCode, measurement: Measurement = {}): CheckResult {
  return { code, outcome: 'passed', reason: null, measurement };
}

export function failed(
  code: CheckCode,
  reason: RejectionReason,
  measurement: Measurement = {},
): CheckResult {
  return { code, outcome: 'failed', reason, measurement };
}

export function skipped(code: CheckCode, because: string): CheckResult {
  return { code, outcome: 'skipped', reason: null, measurement: { skippedBecause: because } };
}
