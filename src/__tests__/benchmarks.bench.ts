/**
 * Performance benchmarks for signals-core
 */

import { bench, describe } from 'vitest';
import { signal, computed, effect, batch } from '../index.js';

describe('benchmarks', () => {
  describe('signal operations', () => {
    bench('1M signal reads', () => {
      const s = signal(0);
      for (let i = 0; i < 1_000_000; i++) {
        s();
      }
    });

    bench('100K signal writes (no dependents)', () => {
      const s = signal(0);
      for (let i = 0; i < 100_000; i++) {
        s.set(i);
      }
    });

    bench('signal write with 10 computed dependents', () => {
      const s = signal(0);
      const computeds = Array.from({ length: 10 }, () =>
        computed(() => s() * 2)
      );

      for (let i = 0; i < 10_000; i++) {
        s.set(i);
        // Read one computed to trigger recomputation
        computeds[0]!();
      }
    });

    bench('signal write with 10 effects', () => {
      const s = signal(0);
      const handles = Array.from({ length: 10 }, () => {
        let value = 0;
        return effect(() => {
          value = s();
        });
      });

      for (let i = 0; i < 10_000; i++) {
        s.set(i);
      }

      // Cleanup
      handles.forEach(h => h.dispose());
    });
  });

  describe('computed operations', () => {
    bench('computed recomputation', () => {
      const s = signal(0);
      const c = computed(() => s() * 2);

      for (let i = 0; i < 100_000; i++) {
        s.set(i);
        c(); // Force recomputation
      }
    });

    bench('100-deep computed chain', () => {
      const source = signal(1);

      // Create chain: c0 = source, c1 = c0 + 1, c2 = c1 + 1, ...
      const computeds = [computed(() => source())];
      for (let i = 1; i < 100; i++) {
        const prev = computeds[i - 1]!;
        computeds.push(computed(() => prev() + 1));
      }

      const final = computeds[99]!;

      // Benchmark: update source and read final value
      for (let i = 0; i < 1_000; i++) {
        source.set(i);
        final();
      }
    });

    bench('wide fan-out (1 signal → 100 computeds)', () => {
      const source = signal(0);
      const computeds = Array.from({ length: 100 }, (_, i) =>
        computed(() => source() * (i + 1))
      );

      for (let i = 0; i < 1_000; i++) {
        source.set(i);
        // Read all computeds
        computeds.forEach(c => c());
      }
    });

    bench('diamond dependency recomputation', () => {
      const source = signal(0);
      const left = computed(() => source() * 2);
      const right = computed(() => source() * 3);
      const result = computed(() => left() + right());

      for (let i = 0; i < 100_000; i++) {
        source.set(i);
        result();
      }
    });
  });

  describe('effect operations', () => {
    bench('effect execution', () => {
      const s = signal(0);
      let value = 0;
      const handle = effect(() => {
        value = s();
      });

      for (let i = 0; i < 10_000; i++) {
        s.set(i);
      }

      handle.dispose();
    });

    bench('wide fan-out (1 signal → 100 effects)', () => {
      const source = signal(0);
      const values: number[] = [];
      const handles = Array.from({ length: 100 }, (_, i) => {
        values[i] = 0;
        return effect(() => {
          values[i] = source();
        });
      });

      for (let i = 0; i < 1_000; i++) {
        source.set(i);
      }

      handles.forEach(h => h.dispose());
    });

    bench('effect with cleanup', () => {
      const s = signal(0);
      let cleanupCount = 0;

      const handle = effect(() => {
        s();
        return () => {
          cleanupCount++;
        };
      });

      for (let i = 0; i < 10_000; i++) {
        s.set(i);
      }

      handle.dispose();
    });
  });

  describe('batch operations', () => {
    bench('batch with 100 writes', () => {
      const signals = Array.from({ length: 100 }, () => signal(0));
      const sum = computed(() => signals.reduce((acc, s) => acc + s(), 0));

      for (let i = 0; i < 1_000; i++) {
        batch(() => {
          signals.forEach(s => s.set(i));
        });
        sum(); // Read to force recomputation
      }
    });

    bench('batch with 100 writes and 10 effects', () => {
      const signals = Array.from({ length: 100 }, () => signal(0));
      const handles = signals.map(s => {
        let value = 0;
        return effect(() => {
          value = s();
        });
      });

      for (let i = 0; i < 1_000; i++) {
        batch(() => {
          signals.forEach(s => s.set(i));
        });
      }

      handles.forEach(h => h.dispose());
    });

    bench('nested batches', () => {
      const s1 = signal(0);
      const s2 = signal(0);
      const s3 = signal(0);
      let value = 0;

      const handle = effect(() => {
        value = s1() + s2() + s3();
      });

      for (let i = 0; i < 10_000; i++) {
        batch(() => {
          s1.set(i);
          batch(() => {
            s2.set(i * 2);
            s3.set(i * 3);
          });
        });
      }

      handle.dispose();
    });
  });

  describe('complex scenarios', () => {
    bench('todo list filtering (realistic app scenario)', () => {
      interface Todo {
        id: number;
        text: string;
        done: boolean;
      }

      const todos = signal<Todo[]>(
        Array.from({ length: 100 }, (_, i) => ({
          id: i,
          text: `Task ${i}`,
          done: i % 2 === 0,
        }))
      );

      const filter = signal<'all' | 'active' | 'completed'>('all');

      const filteredTodos = computed(() => {
        const f = filter();
        const t = todos();
        if (f === 'active') return t.filter(todo => !todo.done);
        if (f === 'completed') return t.filter(todo => todo.done);
        return t;
      });

      const count = computed(() => filteredTodos().length);

      // Benchmark: toggle filter and read count
      for (let i = 0; i < 10_000; i++) {
        filter.set(i % 3 === 0 ? 'all' : i % 3 === 1 ? 'active' : 'completed');
        count();
      }
    });

    bench('reactive state machine', () => {
      type State = 'idle' | 'loading' | 'success' | 'error';

      const state = signal<State>('idle');
      const data = signal<string | null>(null);
      const error = signal<string | null>(null);

      const isLoading = computed(() => state() === 'loading');
      const hasData = computed(() => state() === 'success' && data() !== null);
      const hasError = computed(() => state() === 'error' && error() !== null);

      const statusMessage = computed(() => {
        if (isLoading()) return 'Loading...';
        if (hasData()) return `Data: ${data()}`;
        if (hasError()) return `Error: ${error()}`;
        return 'Idle';
      });

      // Benchmark: cycle through states
      for (let i = 0; i < 10_000; i++) {
        batch(() => {
          state.set('loading');
          data.set(null);
          error.set(null);
        });
        statusMessage();

        batch(() => {
          state.set('success');
          data.set('Result');
        });
        statusMessage();

        batch(() => {
          state.set('error');
          data.set(null);
          error.set('Failed');
        });
        statusMessage();

        batch(() => {
          state.set('idle');
          error.set(null);
        });
        statusMessage();
      }
    });

    bench('create and dispose 1000 effects', () => {
      const s = signal(0);

      for (let i = 0; i < 1_000; i++) {
        const handle = effect(() => {
          s();
        });
        handle.dispose();
      }
    });

    bench('large reactive graph (100 signals, 200 computeds, 50 effects)', () => {
      // Create base signals
      const signals = Array.from({ length: 100 }, () => signal(0));

      // Create computeds that read multiple signals
      const computeds = Array.from({ length: 200 }, (_, i) => {
        const s1 = signals[i % signals.length]!;
        const s2 = signals[(i + 1) % signals.length]!;
        return computed(() => s1() + s2());
      });

      // Create effects that read computeds
      const handles = Array.from({ length: 50 }, (_, i) => {
        let value = 0;
        return effect(() => {
          const c = computeds[i % computeds.length]!;
          value = c();
        });
      });

      // Benchmark: update signals
      for (let i = 0; i < 100; i++) {
        batch(() => {
          signals.forEach((s, idx) => s.set(i + idx));
        });
      }

      // Cleanup
      handles.forEach(h => h.dispose());
    });
  });
});
