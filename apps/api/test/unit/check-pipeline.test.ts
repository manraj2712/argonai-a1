import { describe, expect, it, vi } from 'vitest';
import type { AnalyzedImage } from '../../src/modules/processing/analysis/analyzed-image.js';
import {
  failed,
  passed,
  type GateCheck,
  type QualityCheck,
} from '../../src/modules/processing/checks/check.js';
import { CheckPipeline } from '../../src/modules/processing/checks/check-pipeline.js';
import type { OriginalImage } from '../../src/modules/processing/decoding/original-image.js';

const original = {} as OriginalImage;
const analyzed = {} as AnalyzedImage;

function gate(result: ReturnType<typeof passed>): GateCheck {
  return { code: result.code, run: vi.fn(() => Promise.resolve(result)) };
}

function quality(result: ReturnType<typeof passed>): QualityCheck {
  return { code: result.code, run: vi.fn(() => Promise.resolve(result)) };
}

describe('CheckPipeline', () => {
  it('stops at the first failing gate check', async () => {
    const runThird = vi.fn(() => Promise.resolve(passed('resolution')));
    const pipeline = new CheckPipeline(
      [
        gate(passed('file_size')),
        gate(failed('format', 'unsupported_format')),
        { code: 'resolution', run: runThird },
      ],
      [],
    );

    const outcome = await pipeline.runGate(original);

    expect(outcome.passed).toBe(false);
    expect(outcome.results.map((result) => result.code)).toEqual(['file_size', 'format']);
    expect(runThird).not.toHaveBeenCalled();
  });

  it('runs every quality check even when several fail', async () => {
    const pipeline = new CheckPipeline(
      [],
      [
        quality(failed('blur', 'blurry')),
        quality(failed('face_count', 'multiple_faces')),
        quality(passed('face_size')),
      ],
    );

    const results = await pipeline.runQuality(analyzed);

    expect(results.map((result) => result.reason)).toEqual(['blurry', 'multiple_faces', null]);
  });
});
