/**
 * Tests for batch() - batching system
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect, batch } from '../index.js';

describe('batch', () => {
  test('groups multiple writes into single flush', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a() + b());
    let runs = 0;

    effect(() => {
      runs++;
      sum();
    });

    expect(runs).toBe(1);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    expect(runs).toBe(2); // Only 1 additional run, not 2
  });

  test('prevents glitches in diamond dependencies', () => {
    const a = signal(1);
    const b = computed(() => a());
    const c = computed(() => a());
    let values: number[] = [];

    effect(() => {
      values.push(b() + c());
    });

    expect(values).toEqual([2]); // Initial: 1+1

    batch(() => {
      a.set(10);
    });

    expect(values).toEqual([2, 20]); // No intermediate [11] or other glitch
  });

  test('returns callback result', () => {
    const a = signal(1);
    const b = signal(2);

    const result = batch(() => {
      a.set(10);
      b.set(20);
      return a() + b();
    });

    expect(result).toBe(30);
  });

  test('nested batches - flush only at outermost', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      runs++;
      count();
    });

    expect(runs).toBe(1);

    batch(() => {
      count.set(1);
      batch(() => {
        count.set(2);
      });
      count.set(3);
    });

    expect(runs).toBe(2); // Only 1 flush after outermost batch
  });

  test('batch with no writes', () => {
    const count = signal(5);
    const result = batch(() => count());
    expect(result).toBe(5);
  });

  test('batch flushes only once at outermost level', () => {
    const count = signal(0);
    let effect1 = 0;
    let effect2 = 0;

    effect(() => {
      effect1++;
      count();
    });
    effect(() => {
      effect2++;
      count();
    });

    expect(effect1).toBe(1);
    expect(effect2).toBe(1);

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    expect(effect1).toBe(2); // +1 flush
    expect(effect2).toBe(2); // +1 flush
  });

  test('batch with exception still flushes', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      runs++;
      count();
    });

    expect(runs).toBe(1);

    try {
      batch(() => {
        count.set(1);
        throw new Error('test');
      });
    } catch (e) {
      // Expected
    }

    expect(runs).toBe(2); // Flush still happened
  });

  test('nested batches with exceptions maintain correct depth', () => {
    const count = signal(0);
    let runs = 0;

    effect(() => {
      runs++;
      count();
    });

    expect(runs).toBe(1);

    batch(() => {
      count.set(1);
      try {
        batch(() => {
          count.set(2);
          throw new Error('inner');
        });
      } catch (e) {
        // Inner batch threw
      }
      count.set(3);
    }); // Outer batch completes

    expect(runs).toBe(2); // One flush at end
  });

  test('multiple effects execute in same batch', () => {
    const count = signal(0);
    let runs1 = 0;
    let runs2 = 0;

    effect(() => {
      runs1++;
      count();
    });

    effect(() => {
      runs2++;
      count();
    });

    expect(runs1).toBe(1);
    expect(runs2).toBe(1);

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    expect(runs1).toBe(2); // Both effects run once in the batch
    expect(runs2).toBe(2);
  });
});
