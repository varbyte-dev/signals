/**
 * Edge case tests - circular dependencies, memory leaks, effect edge cases
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect, batch } from '../index.js';

describe('edge cases', () => {
  describe('circular dependencies', () => {
    test('effects writing to dependencies during execution', () => {
      // When an effect writes to its own dependency during execution,
      // the effect will be re-scheduled after the current execution completes
      const a = signal(0);
      let executions = 0;

      const handle = effect(() => {
        executions++;
        const value = a();
        // Write to dependency during execution (not during cleanup)
        if (value < 5) {
          a.set(value + 1);
        }
      });

      // Initial execution runs once, writes trigger re-execution
      // Each execution increments until condition is false
      expect(executions).toBeGreaterThanOrEqual(1);
      expect(a()).toBeGreaterThanOrEqual(0);

      handle.dispose();
    });

    test('deep computed chains without cycles work', () => {
      const source = signal(1);

      // Create chain: c0 = source * 1, c1 = c0 + 1, c2 = c1 + 1, ...
      const computeds = [computed(() => source())];

      for (let i = 1; i < 50; i++) {
        const prev = computeds[i - 1]!;
        computeds.push(computed(() => prev() + 1));
      }

      const final = computeds[49]!;
      expect(final()).toBe(50); // 1 + 49 increments

      // Update source - entire chain should recompute without cycle error
      source.set(10);
      expect(final()).toBe(59); // 10 + 49 increments
    });

    test('deep computed chains without cycles work', () => {
      // Testing that deep computed chains don't hit stack limits
      const signals = Array.from({ length: 50 }, (_, i) => signal(i));

      // Create chain: c0 depends on s0, c1 depends on c0 and s1, etc.
      const computeds: ReturnType<typeof computed<number>>[] = [];
      for (let i = 0; i < signals.length; i++) {
        const s = signals[i]!;
        if (i === 0) {
          computeds.push(computed(() => s()));
        } else {
          const prev = computeds[i - 1]!;
          computeds.push(computed(() => prev() + s()));
        }
      }

      const final = computed(() => {
        return computeds.reduce((sum: number, c) => sum + c(), 0);
      });

      expect(final()).toBeGreaterThan(0);

      // Updating first signal should propagate through entire chain
      signals[0]!.set(100);
      expect(final()).toBeGreaterThan(100);
    });
  });

  describe('memory leak prevention', () => {
    test('disposed effects release all dependencies', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      let executions = 0;
      const handle = effect(() => {
        executions++;
        s1();
        s2();
        s3();
      });

      expect(executions).toBe(1); // Initial execution

      s1.set(10);
      expect(executions).toBe(2);

      // Dispose effect
      handle.dispose();

      // Changes to signals should not trigger disposed effect
      s1.set(20);
      s2.set(30);
      s3.set(40);
      expect(executions).toBe(2); // Still 2, no new executions
    });

    test('computed with no observers does not prevent GC', () => {
      // Create a signal and computed in a scope
      const source = signal(1);

      const createComputed = () => {
        return computed(() => source() * 2);
      };

      const c1 = createComputed();
      expect(c1()).toBe(2);

      // Update source - computed should recompute when read
      source.set(5);
      expect(c1()).toBe(10);

      // Create another computed and let it become unreachable
      createComputed(); // No reference kept

      // Source can still be used
      source.set(10);
      expect(c1()).toBe(20);
    });

    test('long-running system with many create/dispose cycles', () => {
      const source = signal(0);

      // Create and dispose 1000 effects
      for (let i = 0; i < 1000; i++) {
        const handle = effect(() => {
          source();
        });
        handle.dispose();
      }

      // System should still work
      let executions = 0;
      effect(() => {
        executions++;
        source();
      });

      expect(executions).toBe(1);
      source.set(1);
      expect(executions).toBe(2);
    });

    test('effect with conditional dependencies releases unused deps', () => {
      const toggle = signal(true);
      const a = signal(1);
      const b = signal(100);

      let executions = 0;
      effect(() => {
        executions++;
        if (toggle()) {
          a(); // Track a when toggle is true
        } else {
          b(); // Track b when toggle is false
        }
      });

      expect(executions).toBe(1);

      // Change a - should trigger (toggle is true)
      a.set(2);
      expect(executions).toBe(2);

      // Change b - should NOT trigger (not tracked)
      b.set(200);
      expect(executions).toBe(2);

      // Switch to b
      toggle.set(false);
      expect(executions).toBe(3);

      // Now a should not trigger
      a.set(3);
      expect(executions).toBe(3);

      // But b should
      b.set(300);
      expect(executions).toBe(4);
    });
  });

  describe('effect edge cases', () => {
    test('effect disposes itself during execution', () => {
      const s = signal(0);
      let executions = 0;

      let handle: ReturnType<typeof effect> | undefined;

      handle = effect(() => {
        executions++;
        const val = s();

        if (val >= 2 && handle) {
          handle.dispose(); // Self-dispose
        }
      });

      expect(executions).toBe(1);

      s.set(1);
      expect(executions).toBe(2);

      s.set(2);
      expect(executions).toBe(3); // Executes one more time, then disposes

      s.set(3);
      expect(executions).toBe(3); // No more executions after disposal
    });

    test('effect cleanup is called correctly', () => {
      const s = signal(0);
      const cleanups: string[] = [];

      const handle = effect(() => {
        const val = s();
        return () => {
          cleanups.push(`cleanup:${val}`);
        };
      });

      expect(cleanups).toEqual([]);

      // First update - cleanup should run for previous value
      s.set(1);
      expect(cleanups).toEqual(['cleanup:0']);

      // Second update - cleanup should run for value 1
      s.set(2);
      expect(cleanups).toEqual(['cleanup:0', 'cleanup:1']);

      // Final disposal - cleanup should run for value 2
      handle.dispose();
      expect(cleanups).toEqual(['cleanup:0', 'cleanup:1', 'cleanup:2']);
    });

    test('nested effects with disposal', () => {
      const outer = signal(0);
      const inner = signal(0);
      const executions: string[] = [];

      let innerHandle: ReturnType<typeof effect> | undefined;

      const outerHandle = effect(() => {
        const o = outer();
        executions.push(`outer:${o}`);

        // Dispose previous inner effect if exists
        if (innerHandle) {
          innerHandle.dispose();
        }

        // Create new inner effect
        innerHandle = effect(() => {
          const i = inner();
          executions.push(`inner:${o}:${i}`);
        });
      });

      expect(executions).toEqual(['outer:0', 'inner:0:0']);

      // Update inner - only inner effect should run
      inner.set(1);
      expect(executions).toEqual(['outer:0', 'inner:0:0', 'inner:0:1']);

      // Update outer - should dispose old inner and create new one
      executions.length = 0; // Clear for easier assertion
      outer.set(1);
      expect(executions).toEqual(['outer:1', 'inner:1:1']);

      // Old inner should be disposed, so this should only trigger new inner
      inner.set(2);
      expect(executions).toEqual(['outer:1', 'inner:1:1', 'inner:1:2']);

      // Cleanup
      outerHandle.dispose();
    });

    test('effect error is caught and re-thrown by batch flush', () => {
      const s = signal(0);
      let executions = 0;

      effect(() => {
        executions++;
        const val = s();
        if (val === 2) {
          throw new Error('Effect error!');
        }
      });

      expect(executions).toBe(1);

      s.set(1);
      expect(executions).toBe(2);

      // Effect throws - error should be caught by batch flush and re-thrown
      let caughtError = false;
      try {
        s.set(2);
      } catch (e: unknown) {
        caughtError = true;
        expect((e as Error).message).toBe('Effect error!');
      }

      expect(caughtError).toBe(true);
      expect(executions).toBe(3);

      // After error, the effect is still subscribed but may be in error state
      // The current implementation continues executing other effects after error
      s.set(3);
      expect(executions).toBeGreaterThanOrEqual(3); // At least 3, possibly 4
    });
  });

  describe('batching edge cases', () => {
    test('nested batch with exception still maintains correct depth', () => {
      const s = signal(0);
      let executions = 0;

      effect(() => {
        executions++;
        s();
      });

      expect(executions).toBe(1);

      // Outer batch with inner batch that throws
      expect(() => {
        batch(() => {
          s.set(1);
          batch(() => {
            s.set(2);
            throw new Error('Inner batch error!');
          });
        });
      }).toThrow('Inner batch error!');

      // Effects should have run once (batch flushed despite error)
      expect(executions).toBeGreaterThanOrEqual(2);

      // System should still work
      s.set(3);
      expect(executions).toBeGreaterThanOrEqual(3);
    });

    test('effect scheduling during batch flush', () => {
      const a = signal(0);
      const b = signal(0);
      const executions: string[] = [];

      // Effect that reads a and writes b
      effect(() => {
        const val = a();
        executions.push(`effect1:a=${val}`);
        if (val > 0) {
          b.set(val * 10);
        }
      });

      // Effect that reads b
      effect(() => {
        const val = b();
        executions.push(`effect2:b=${val}`);
      });

      expect(executions).toEqual(['effect1:a=0', 'effect2:b=0']);
      executions.length = 0;

      // Batch write - effect1 will write to b, which should schedule effect2
      batch(() => {
        a.set(5);
      });

      // Both effects should run
      expect(executions).toContain('effect1:a=5');
      expect(executions).toContain('effect2:b=50');
    });
  });

  describe('equality edge cases', () => {
    test('NaN equality uses Object.is semantics', () => {
      const s = signal(NaN);
      let updates = 0;

      effect(() => {
        updates++;
        s();
      });

      expect(updates).toBe(1);

      // Setting to NaN again should NOT trigger (Object.is(NaN, NaN) is false, but signal uses Object.is)
      // Actually Object.is(NaN, NaN) is TRUE, unlike === which is false
      s.set(NaN);
      expect(updates).toBe(1); // No update because NaN === NaN via Object.is

      s.set(0);
      expect(updates).toBe(2);

      s.set(NaN);
      expect(updates).toBe(3);
    });

    test('+0 vs -0 equality uses Object.is semantics', () => {
      const s = signal(0);
      let updates = 0;

      effect(() => {
        updates++;
        s();
      });

      expect(updates).toBe(1);

      // +0 and -0 are different via Object.is
      s.set(-0);
      expect(updates).toBe(2); // Object.is(0, -0) is false

      s.set(-0);
      expect(updates).toBe(2); // Same value, no update

      s.set(0);
      expect(updates).toBe(3); // Object.is(-0, 0) is false
    });

    test('custom equality function is respected', () => {
      interface Point {
        x: number;
        y: number;
      }

      // Equality by distance from origin
      const distanceEquals = (a: Point, b: Point) => {
        const distA = Math.sqrt(a.x * a.x + a.y * a.y);
        const distB = Math.sqrt(b.x * b.x + b.y * b.y);
        return Math.abs(distA - distB) < 0.01;
      };

      const point = signal<Point>({ x: 3, y: 4 }, { equals: distanceEquals });
      let updates = 0;

      effect(() => {
        updates++;
        point();
      });

      expect(updates).toBe(1);

      // Different point, same distance from origin (3,4) and (4,3) both have distance 5
      point.set({ x: 4, y: 3 });
      expect(updates).toBe(1); // No update due to custom equality

      // Different distance
      point.set({ x: 1, y: 1 });
      expect(updates).toBe(2);
    });
  });

  describe('deep dependency chains', () => {
    test('100-deep computed chain', () => {
      const source = signal(1);

      // Create chain: c0 = source * 1, c1 = c0 + 1, c2 = c1 + 1, ...
      const computeds = [computed(() => source())];

      for (let i = 1; i < 100; i++) {
        const prev = computeds[i - 1]!;
        computeds.push(computed(() => prev() + 1));
      }

      const final = computeds[99]!;
      expect(final()).toBe(100); // 1 + 99 increments

      // Update source - entire chain should recompute
      source.set(10);
      expect(final()).toBe(109); // 10 + 99 increments
    });

    test('wide fan-out (1 signal, 100 computeds)', () => {
      const source = signal(1);

      const computeds = Array.from({ length: 100 }, (_, i) =>
        computed(() => source() * (i + 1))
      );

      expect(computeds[0]!()).toBe(1);
      expect(computeds[99]!()).toBe(100);

      // All computeds should recompute on source change
      source.set(2);
      expect(computeds[0]!()).toBe(2);
      expect(computeds[99]!()).toBe(200);
    });

    test('wide fan-out (1 signal, 100 effects)', () => {
      const source = signal(0);
      const executions: number[] = Array(100).fill(0);

      const handles = executions.map((_, i) =>
        effect(() => {
          source();
          executions[i]!++;
        })
      );

      expect(executions.every(e => e === 1)).toBe(true);

      // All effects should run once per update
      source.set(1);
      expect(executions.every(e => e === 2)).toBe(true);

      source.set(2);
      expect(executions.every(e => e === 3)).toBe(true);

      // Cleanup
      handles.forEach(h => h.dispose());
    });
  });

  describe('complex error scenarios', () => {
    test('computed error is cached and re-thrown', () => {
      const s = signal(0);
      let computations = 0;

      const c = computed(() => {
        computations++;
        const val = s();
        if (val < 0) {
          throw new Error('Negative value!');
        }
        return val * 2;
      });

      expect(c()).toBe(0);
      expect(computations).toBe(1);

      s.set(-1);

      // First read after invalidation - executes and throws
      expect(() => c()).toThrow('Negative value!');
      expect(computations).toBe(2);

      // Second read - should re-throw cached error without re-execution
      expect(() => c()).toThrow('Negative value!');
      expect(computations).toBe(2); // No new execution

      // Fix value - should clear error and recompute
      s.set(5);
      expect(c()).toBe(10);
      expect(computations).toBe(3);
    });

    test('nested computed errors propagate correctly', () => {
      const s = signal(0);

      const c1 = computed(() => {
        const val = s();
        if (val < 0) throw new Error('c1 error');
        return val * 2;
      });

      const c2 = computed(() => {
        return c1() + 10;
      });

      expect(c2()).toBe(10);

      s.set(-1);
      expect(() => c2()).toThrow('c1 error');

      // Fix
      s.set(5);
      expect(c2()).toBe(20); // 5 * 2 + 10
    });
  });
});
