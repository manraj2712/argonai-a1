import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../src/lib/run-with-concurrency';

describe('runWithConcurrency', () => {
  it('never runs more than the limit at once and still finishes everything', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      done.push(item);
    });

    expect(peak).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps going when a task fails', async () => {
    const done: number[] = [];
    await runWithConcurrency([1, 2, 3], 1, (item) => {
      if (item === 2) return Promise.reject(new Error('boom'));
      done.push(item);
      return Promise.resolve();
    });
    expect(done).toEqual([1, 3]);
  });
});
