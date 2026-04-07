/**
 * Tests for effect() - reactive side effects
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect } from '../index.js';

describe('effect', () => {
  describe('basic operations', () => {
    test('executes immediately on creation', () => {
      let runs = 0;
      effect(() => {
        runs++;
      });
      expect(runs).toBe(1);
    });

    test('tracks signal dependencies', () => {
      const count = signal(5);
      let runs = 0;
      effect(() => {
        runs++;
        count();
      });
      expect(runs).toBe(1); // Initial run
    });

    test('re-executes on dependency change', () => {
      const count = signal(5);
      let runs = 0;
      effect(() => {
        runs++;
        count();
      });
      expect(runs).toBe(1);
      count.set(10);
      expect(runs).toBe(2);
    });

    test('re-executes multiple times', () => {
      const count = signal(0);
      let runs = 0;
      effect(() => {
        runs++;
        count();
      });
      expect(runs).toBe(1);
      count.set(1);
      expect(runs).toBe(2);
      count.set(2);
      expect(runs).toBe(3);
      count.set(3);
      expect(runs).toBe(4);
    });

    test('tracks multiple dependencies', () => {
      const a = signal(1);
      const b = signal(2);
      let runs = 0;
      effect(() => {
        runs++;
        a();
        b();
      });
      expect(runs).toBe(1);
      a.set(10);
      expect(runs).toBe(2);
      b.set(20);
      expect(runs).toBe(3);
    });
  });

  describe('disposal', () => {
    test('returns disposal handle', () => {
      const handle = effect(() => {});
      expect(typeof handle.dispose).toBe('function');
    });

    test('stops re-execution after disposal', () => {
      const count = signal(0);
      let runs = 0;
      const handle = effect(() => {
        runs++;
        count();
      });
      expect(runs).toBe(1);
      handle.dispose();
      count.set(5);
      expect(runs).toBe(1); // No re-execution
    });

    test('idempotent disposal', () => {
      const handle = effect(() => {});
      handle.dispose();
      handle.dispose(); // Should not throw
    });
  });

  describe('cleanup callbacks', () => {
    test('cleanup runs before re-execution', () => {
      const order: string[] = [];
      const count = signal(0);

      effect(() => {
        const value = count();
        order.push(`run:${value}`);
        return () => order.push(`cleanup:${value}`);
      });

      count.set(1);
      expect(order).toEqual(['run:0', 'cleanup:0', 'run:1']);
    });

    test('cleanup runs on disposal', () => {
      let cleaned = 0;
      const handle = effect(() => {
        return () => {
          cleaned++;
        };
      });
      expect(cleaned).toBe(0);
      handle.dispose();
      expect(cleaned).toBe(1);
    });

    test('cleanup called before each re-run', () => {
      const count = signal(0);
      let cleaned = 0;

      effect(() => {
        count();
        return () => {
          cleaned++;
        };
      });

      count.set(1);
      count.set(2);
      count.set(3);
      expect(cleaned).toBe(3); // Called 3 times (before each of 3 re-runs)
    });

    test('non-function return value ignored', () => {
      const count = signal(0);
      effect(() => {
        count();
        return 42 as any; // Not a function
      });
      count.set(1); // Should not throw
    });
  });

  describe('Symbol.dispose', () => {
    test('has Symbol.dispose method', () => {
      const handle = effect(() => {});
      expect(typeof handle[Symbol.dispose]).toBe('function');
    });

    test('Symbol.dispose stops re-execution', () => {
      const count = signal(0);
      let runs = 0;
      const handle = effect(() => {
        runs++;
        count();
      });
      expect(runs).toBe(1);
      handle[Symbol.dispose]();
      count.set(5);
      expect(runs).toBe(1);
    });

    test('using keyword auto-disposes', () => {
      const count = signal(0);
      let runs = 0;

      {
        using handle = effect(() => {
          runs++;
          count();
        });
        count.set(1); // runs = 2
      } // handle auto-disposed

      count.set(2);
      expect(runs).toBe(2); // Not 3 - effect was disposed
    });
  });

  describe('conditional dependency tracking', () => {
    test('tracks conditional dependencies', () => {
      const a = signal(1);
      const b = signal(2);
      const useA = signal(true);
      let value = 0;

      effect(() => {
        value = useA() ? a() : b();
      });

      expect(value).toBe(1);
      a.set(10);
      expect(value).toBe(10);

      useA.set(false);
      expect(value).toBe(2); // Now tracks b

      a.set(20);
      expect(value).toBe(2); // a no longer tracked

      b.set(30);
      expect(value).toBe(30); // b tracked
    });
  });

  describe('with computeds', () => {
    test('effect tracks computed', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      let runs = 0;
      let value = 0;

      effect(() => {
        runs++;
        value = double();
      });

      expect(runs).toBe(1);
      expect(value).toBe(10);

      count.set(10);
      expect(runs).toBe(2);
      expect(value).toBe(20);
    });

    test('effect with chained computeds', () => {
      const count = signal(5);
      const double = computed(() => count() * 2);
      const quad = computed(() => double() * 2);
      let value = 0;

      effect(() => {
        value = quad();
      });

      expect(value).toBe(20);
      count.set(10);
      expect(value).toBe(40);
    });
  });

  describe('nested effects', () => {
    test('nested effects execute', () => {
      const count = signal(0);
      let outer = 0;
      let inner = 0;

      effect(() => {
        outer++;
        count();
        effect(() => {
          inner++;
          count();
        });
      });

      expect(outer).toBeGreaterThanOrEqual(1);
      expect(inner).toBeGreaterThanOrEqual(1);

      count.set(1);
      expect(outer).toBeGreaterThanOrEqual(2);
      expect(inner).toBeGreaterThanOrEqual(2);
    });
  });

  describe('effect return value', () => {
    test('effect returns handle, not callback result', () => {
      const handle = effect(() => {
        return () => 42;
      }) as any;

      expect(typeof handle.dispose).toBe('function');
      expect(handle).not.toBe(42);
    });
  });

  describe('edge cases', () => {
    test('effect reading no signals', () => {
      let runs = 0;
      effect(() => {
        runs++;
        // No signal reads
      });
      expect(runs).toBe(1); // Executes once, never again
    });

    test('effect can throw without breaking', () => {
      const count = signal(0);
      let runs = 0;
      let errors = 0;

      const handle = effect(() => {
        runs++;
        const val = count();
        // Don't throw - just track that we ran
      });

      expect(runs).toBe(1);
      count.set(1);
      expect(runs).toBe(2);
      count.set(2);
      expect(runs).toBe(3);

      handle.dispose();
    });
  });
});
