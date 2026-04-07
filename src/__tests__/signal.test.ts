/**
 * Tests for signal() - writable reactive primitives
 */

import { describe, test, expect, vi } from 'vitest';
import { signal, computed, effect } from '../index.js';

describe('signal', () => {
  describe('basic operations', () => {
    test('reads initial value', () => {
      const s = signal(42);
      expect(s()).toBe(42);
    });

    test('set updates value', () => {
      const s = signal(0);
      s.set(1);
      expect(s()).toBe(1);
    });

    test('update transforms current value', () => {
      const s = signal(10);
      s.update((n) => n + 5);
      expect(s()).toBe(15);
    });

    test('update receives current value', () => {
      const s = signal(20);
      s.update((n) => {
        expect(n).toBe(20);
        return n * 2;
      });
      expect(s()).toBe(40);
    });

    test('peek reads without tracking', () => {
      const s = signal(5);
      expect(s.peek()).toBe(5);
      s.set(10);
      expect(s.peek()).toBe(10);
    });
  });

  describe('equality checks', () => {
    test('set with same value (default equality) does not trigger updates', () => {
      const s = signal(5);
      const c = computed(() => s() * 2);
      let runs = 0;
      effect(() => {
        c();
        runs++;
      });

      expect(runs).toBe(1);
      s.set(5); // Same value
      expect(runs).toBe(1); // Should not trigger
    });

    test('set with same object reference does not trigger updates', () => {
      const obj = { x: 1 };
      const s = signal(obj);
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set(obj); // Same reference
      expect(runs).toBe(1); // Should not trigger
    });

    test('set with different object (same structure) triggers update with default equality', () => {
      const s = signal({ x: 1 });
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set({ x: 1 }); // Different object, same structure
      expect(runs).toBe(2); // Should trigger (Object.is comparison)
    });

    test('custom equality function prevents updates', () => {
      const s = signal({ x: 1 }, { equals: (a, b) => a.x === b.x });
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set({ x: 1 }); // Different object, same x
      expect(runs).toBe(1); // Should not trigger
    });

    test('custom equality function allows updates when different', () => {
      const s = signal({ x: 1 }, { equals: (a, b) => a.x === b.x });
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set({ x: 2 }); // Different x
      expect(runs).toBe(2); // Should trigger
    });

    test('NaN equality with Object.is', () => {
      const s = signal(NaN);
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set(NaN);
      // Object.is(NaN, NaN) is true, so no update
      expect(runs).toBe(1);
    });

    test('+0 vs -0 equality with Object.is', () => {
      const s = signal(0);
      let runs = 0;
      effect(() => {
        s();
        runs++;
      });

      expect(runs).toBe(1);
      s.set(-0);
      // Object.is(0, -0) is false, so should update
      expect(runs).toBe(2);
    });
  });

  describe('type inference', () => {
    test('signal type is inferred from initial value', () => {
      const s = signal(0);
      // TypeScript should infer s() as number
      const value: number = s();
      expect(value).toBe(0);
    });

    test('signal with explicit type', () => {
      const s = signal<number | null>(null);
      expect(s()).toBe(null);
      s.set(42);
      expect(s()).toBe(42);
    });
  });

  describe('interface', () => {
    test('signal is callable', () => {
      const s = signal(0);
      expect(typeof s).toBe('function');
    });

    test('signal has set method', () => {
      const s = signal(0);
      expect(typeof s.set).toBe('function');
    });

    test('signal has update method', () => {
      const s = signal(0);
      expect(typeof s.update).toBe('function');
    });

    test('signal has peek method', () => {
      const s = signal(0);
      expect(typeof s.peek).toBe('function');
    });
  });

  describe('non-primitive values', () => {
    test('stores and retrieves objects', () => {
      const obj = { count: 0 };
      const s = signal(obj);
      expect(s()).toBe(obj);
      expect(s().count).toBe(0);
    });

    test('stores and retrieves arrays', () => {
      const arr = [1, 2, 3];
      const s = signal(arr);
      expect(s()).toBe(arr);
      expect(s()[0]).toBe(1);
    });

    test('stores and retrieves functions', () => {
      const fn = () => 42;
      const s = signal(fn);
      expect(s()).toBe(fn);
      expect(s()()).toBe(42);
    });
  });
});
