/**
 * Tests for computed() - lazy, memoized derived values
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect } from '../index.js';

describe('computed', () => {
  describe('basic operations', () => {
    test('computes from single signal', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      expect(double()).toBe(10);
    });

    test('tracks multiple dependencies', () => {
      const a = signal(2);
      const b = signal(3);
      const sum = computed(() => a() + b());
      expect(sum()).toBe(5);
    });

    test('is lazy - not executed on creation', () => {
      const count = signal(0);
      let runs = 0;
      const c = computed(() => {
        runs++;
        return count();
      });
      expect(runs).toBe(0); // Not executed until first read
    });

    test('executes on first read', () => {
      const count = signal(5);
      let runs = 0;
      const c = computed(() => {
        runs++;
        return count();
      });
      c(); // First read
      expect(runs).toBe(1);
    });

    test('is memoized - cached value returned on repeated reads', () => {
      const count = signal(5);
      let runs = 0;
      const c = computed(() => {
        runs++;
        return count();
      });
      c(); // First read
      expect(runs).toBe(1);
      c(); // Second read
      expect(runs).toBe(1); // Not re-executed
    });
  });

  describe('invalidation and recomputation', () => {
    test('invalidates on dependency change', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      expect(double()).toBe(10);
      count.set(10);
      expect(double()).toBe(20); // Recomputed
    });

    test('recomputes only once per dependency change', () => {
      const count = signal(5);
      let runs = 0;
      const c = computed(() => {
        runs++;
        return count();
      });
      c(); // First read
      expect(runs).toBe(1);
      count.set(10);
      c(); // Read after change
      expect(runs).toBe(2); // Recomputed once
      c(); // Read again without change
      expect(runs).toBe(2); // Still cached
    });

    test('chained computeds', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      const quad = computed(() => double() * 2);
      expect(quad()).toBe(20);
    });

    test('chained computeds propagate changes', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      const quad = computed(() => double() * 2);
      expect(quad()).toBe(20);
      count.set(10);
      expect(quad()).toBe(40);
    });
  });

  describe('diamond dependency', () => {
    test('each node executes exactly once', () => {
      const a = signal(1);
      let bRuns = 0;
      let cRuns = 0;
      let dRuns = 0;

      const b = computed(() => {
        bRuns++;
        return a() * 2;
      });
      const c = computed(() => {
        cRuns++;
        return a() * 3;
      });
      const d = computed(() => {
        dRuns++;
        return b() + c();
      });

      expect(d()).toBe(5); // a=1, b=2, c=3, d=5
      expect(bRuns).toBe(1);
      expect(cRuns).toBe(1);
      expect(dRuns).toBe(1);

      a.set(2);
      expect(d()).toBe(10); // a=2, b=4, c=6, d=10
      expect(bRuns).toBe(2);
      expect(cRuns).toBe(2);
      expect(dRuns).toBe(2); // NOT 3 - executed once, not twice
    });

    test('wide diamond - 10 branches', () => {
      const a = signal(1);
      const branches = Array.from({ length: 10 }, () => {
        let runs = 0;
        const c = computed(() => {
          runs++;
          return a();
        });
        return { c, runs: () => runs };
      });
      let dRuns = 0;
      const d = computed(() => {
        dRuns++;
        return branches.reduce((sum, { c }) => sum + c(), 0);
      });

      expect(d()).toBe(10); // 10 branches * 1
      branches.forEach(({ runs }) => expect(runs()).toBe(1));
      expect(dRuns).toBe(1);

      a.set(5);
      expect(d()).toBe(50); // 10 branches * 5
      branches.forEach(({ runs }) => expect(runs()).toBe(2));
      expect(dRuns).toBe(2);
    });
  });

  describe('dynamic dependencies', () => {
    test('conditional dependency tracking', () => {
      const a = signal(1);
      const b = signal(2);
      const useA = signal(true);
      let runs = 0;
      const conditional = computed(() => {
        runs++;
        return useA() ? a() : b();
      });

      expect(conditional()).toBe(1); // Uses a
      expect(runs).toBe(1);

      b.set(10);
      expect(conditional()).toBe(1); // b not tracked, no recompute
      expect(runs).toBe(1);

      useA.set(false);
      expect(conditional()).toBe(10); // Now uses b
      expect(runs).toBe(2);

      a.set(20);
      expect(conditional()).toBe(10); // a no longer tracked
      expect(runs).toBe(2);

      b.set(30);
      expect(conditional()).toBe(30); // b tracked now
      expect(runs).toBe(3);
    });

    test('dependency removal', () => {
      const a = signal(1);
      const b = signal(2);
      const useA = signal(true);
      const c = computed(() => (useA() ? a() : b()));

      c(); // Initial read, tracks useA and a
      useA.set(false);
      c(); // Now tracks useA and b (a removed)

      let effectRuns = 0;
      effect(() => {
        c();
        effectRuns++;
      });

      expect(effectRuns).toBe(1);
      a.set(10); // a no longer tracked by c
      expect(effectRuns).toBe(1); // Effect should not re-run
    });
  });

  describe('equality checks', () => {
    test('custom equality prevents downstream recomputation', () => {
      const sig = signal({ x: 1 });
      const c = computed(() => sig(), { equals: (a, b) => a.x === b.x });
      let dRuns = 0;
      const d = computed(() => {
        dRuns++;
        return c().x * 2;
      });

      expect(d()).toBe(2);
      expect(dRuns).toBe(1);

      sig.set({ x: 1 }); // Different object, same x
      expect(d()).toBe(2);
      expect(dRuns).toBe(1); // c's custom equality prevented propagation
    });

    test('custom equality allows updates when different', () => {
      const sig = signal({ x: 1 });
      const c = computed(() => sig(), { equals: (a, b) => a.x === b.x });
      let dRuns = 0;
      const d = computed(() => {
        dRuns++;
        return c().x * 2;
      });

      expect(d()).toBe(2);
      expect(dRuns).toBe(1);

      sig.set({ x: 2 }); // Different x
      expect(d()).toBe(4);
      expect(dRuns).toBe(2); // Recomputed
    });
  });

  describe('error handling', () => {
    test('caches errors', () => {
      const count = signal(0);
      let runs = 0;
      const c = computed(() => {
        runs++;
        if (count() === 0) throw new Error('zero');
        return count();
      });

      expect(() => c()).toThrow('zero');
      expect(runs).toBe(1);

      expect(() => c()).toThrow('zero'); // Re-throws cached error
      expect(runs).toBe(1); // NOT re-executed
    });

    test('error cleared on recomputation', () => {
      const count = signal(0);
      const c = computed(() => {
        if (count() === 0) throw new Error('zero');
        return count();
      });

      expect(() => c()).toThrow('zero');
      count.set(5);
      expect(c()).toBe(5); // Error cleared, successful recomputation
    });

    test('error in nested computeds', () => {
      const count = signal(0);
      const a = computed(() => {
        if (count() === 0) throw new Error('zero');
        return count();
      });
      const b = computed(() => a() * 2);

      expect(() => b()).toThrow('zero'); // Error propagates
      count.set(5);
      expect(b()).toBe(10); // Error cleared
    });
  });

  describe('interface', () => {
    test('computed is callable', () => {
      const c = computed(() => 5);
      expect(typeof c).toBe('function');
    });

    test('computed is read-only (no set/update)', () => {
      const c = computed(() => 5) as any;
      expect(c.set).toBeUndefined();
      expect(c.update).toBeUndefined();
    });
  });

  describe('type inference', () => {
    test('infers return type from function', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      const value: number = double();
      expect(value).toBe(10);
    });

    test('explicit generic type', () => {
      const c = computed<string>(() => 'hello');
      const value: string = c();
      expect(value).toBe('hello');
    });
  });

  describe('with no dependencies', () => {
    test('computed with no dependencies executes once', () => {
      let runs = 0;
      const c = computed(() => {
        runs++;
        return 42;
      });
      c();
      expect(runs).toBe(1);
      c();
      expect(runs).toBe(1); // Cached
    });
  });
});
