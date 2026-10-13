import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from '../../src/modules/images/image-status.js';

describe('image status transitions', () => {
  it.each([
    ['awaiting_upload', 'pending'],
    ['pending', 'processing'],
    ['processing', 'accepted'],
    ['processing', 'rejected'],
    ['processing', 'pending'],
    ['processing', 'failed'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['awaiting_upload', 'accepted'],
    ['pending', 'accepted'],
    ['accepted', 'pending'],
    ['rejected', 'accepted'],
    ['failed', 'pending'],
  ] as const)('refuses %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => {
      assertTransition(from, to);
    }).toThrow(/Illegal/);
  });
});
