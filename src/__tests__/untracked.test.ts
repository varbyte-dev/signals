/**
 * Tests for untracked() - untracked reads
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect, untracked } from '../index.js';

describe('untracked', () => {
  test('untracked read in computed does not register dependency', () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;

    const c = computed(() => {
      runs++;
      return a() + untracked(() => b());
    });

    expect(c()).toBe(3);
    expect(runs).toBe(1);

    b.set(10);
    expect(c()).toBe(3); // b not tracked, no recomputation
    expect(runs).toBe(1);

    a.set(5);
    expect(c()).toBe(15); // a tracked, recomputed with new b value
    expect(runs).toBe(2);
  });

  test('untracked read in effect does not register dependency', () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;

    effect(() => {
      runs++;
      a();
      untracked(() => b());
    });

    expect(runs).toBe(1);

    b.set(10);
    expect(runs).toBe(1); // b not tracked, no re-run

    a.set(5);
    expect(runs).toBe(2); // a tracked, re-run
  });

  test('untracked returns callback result', () => {
    const count = signal(5);
    const result = untracked(() => count() * 2);
    expect(result).toBe(10);
  });

  test('nested untracked', () => {
    const a = signal(1);
    const b = signal(2);
    const c = signal(3);
    let runs = 0;

    const result = computed(() => {
      runs++;
      return (
        a() +
        untracked(() => {
          return b() + untracked(() => c());
        })
      );
    });

    expect(result()).toBe(6);
    expect(runs).toBe(1);

    b.set(10);
    c.set(10);
    expect(result()).toBe(6); // b and c untracked
    expect(runs).toBe(1);

    a.set(5);
    expect(result()).toBe(25); // a tracked: 5 + 10 + 10
    expect(runs).toBe(2);
  });

  test('untracked in top-level code (no-op)', () => {
    const count = signal(5);
    const result = untracked(() => count());
    expect(result).toBe(5);
  });

  test('peek() uses untracked', () => {
    const a = signal(1);
    let runs = 0;

    const c = computed(() => {
      runs++;
      return a.peek() * 2;
    });

    expect(c()).toBe(2);
    expect(runs).toBe(1);

    a.set(10);
    expect(c()).toBe(2); // peek doesn't track, no recomputation
    expect(runs).toBe(1);
  });

  test('untracked with multiple signals', () => {
    const a = signal(1);
    const b = signal(2);
    const c = signal(3);
    let runs = 0;

    const result = computed(() => {
      runs++;
      return a() + untracked(() => b() + c());
    });

    expect(result()).toBe(6);
    expect(runs).toBe(1);

    b.set(10);
    c.set(10);
    expect(result()).toBe(6); // b and c untracked
    expect(runs).toBe(1);

    a.set(5);
    expect(result()).toBe(25); // a tracked: 5 + 20
    expect(runs).toBe(2);
  });

  test('mixed tracked and untracked reads', () => {
    const a = signal(1);
    const b = signal(2);
    const c = signal(3);
    let runs = 0;

    const result = computed(() => {
      runs++;
      return a() + untracked(() => b()) + c();
    });

    expect(result()).toBe(6); // 1 + 2 + 3
    expect(runs).toBe(1);

    b.set(10);
    expect(result()).toBe(6); // b untracked
    expect(runs).toBe(1);

    a.set(5);
    expect(result()).toBe(18); // 5 + 10 + 3
    expect(runs).toBe(2);

    c.set(10);
    expect(result()).toBe(25); // 5 + 10 + 10
    expect(runs).toBe(3);
  });
});
