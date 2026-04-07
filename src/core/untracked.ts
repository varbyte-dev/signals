/**
 * Untracked reads - read signals without registering dependencies.
 */

import { _currentConsumer, setCurrentConsumer } from './context.js';

/**
 * Execute a function without tracking dependencies.
 * Signal reads inside the function will not register as dependencies
 * of the current computed or effect.
 *
 * @param fn - The function to execute
 * @returns The return value of fn
 *
 * @example
 * ```typescript
 * const a = signal(1);
 * const b = signal(2);
 *
 * const c = computed(() => a() + untracked(() => b()));
 * console.log(c()); // 3
 *
 * b.set(10);
 * console.log(c()); // 3 (b not tracked, no recomputation)
 *
 * a.set(5);
 * console.log(c()); // 15 (a tracked, recomputed with new b value)
 * ```
 */
export function untracked<T>(fn: () => T): T {
  const prevConsumer = _currentConsumer;
  setCurrentConsumer(null);
  try {
    return fn();
  } finally {
    setCurrentConsumer(prevConsumer);
  }
}
