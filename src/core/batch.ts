/**
 * Batching system - groups signal writes into single flush cycles.
 */

import {
  _batchDepth,
  _batchIteration,
  _pendingEffects,
  _lastPendingEffect,
  incrementBatchDepth,
  decrementBatchDepth,
  setPendingEffects,
  setLastPendingEffect,
  resetBatchIteration,
  incrementBatchIteration,
} from './context.js';
import type { EffectNode } from './effect.js';
import { executeEffect } from './effect.js';

/**
 * Schedule an effect for execution during the next flush.
 */
export function scheduleEffect(effect: EffectNode): void {
  // Check if already queued
  if (effect._nextEffect !== null || effect === _lastPendingEffect) {
    return;
  }

  // Append to queue
  if (_lastPendingEffect !== null) {
    _lastPendingEffect._nextEffect = effect;
  } else {
    setPendingEffects(effect);
  }
  setLastPendingEffect(effect);

  // If not in batch, flush immediately
  if (_batchDepth === 0) {
    flush();
  }
}

/**
 * Flush all pending effects.
 * Continues flushing until queue is empty or cycle limit reached.
 */
export function flush(): void {
  resetBatchIteration();

  while (_pendingEffects !== null) {
    incrementBatchIteration();

    if (_batchIteration > 100) {
      // Cycle detected - clear queue and throw
      setPendingEffects(null);
      setLastPendingEffect(null);
      throw new Error(
        'Cycle detected: effect flush exceeded 100 iterations. ' +
          'This usually means an effect is writing to its own dependency.',
      );
    }

    // Snapshot current queue
    const effects = _pendingEffects;
    setPendingEffects(null);
    setLastPendingEffect(null);

    // Execute all effects in snapshot
    let effect: EffectNode | null = effects;
    let firstError: unknown = undefined;

    while (effect !== null) {
      const next: EffectNode | null = effect._nextEffect;
      effect._nextEffect = null;

      if (!effect._disposed) {
        try {
          executeEffect(effect);
        } catch (error) {
          // Capture first error but continue executing other effects
          if (firstError === undefined) {
            firstError = error;
          }
        }
      }

      effect = next;
    }

    // Re-throw the first error after all effects have executed
    if (firstError !== undefined) {
      throw firstError;
    }
  }
}

/**
 * Group multiple signal writes into a single flush cycle.
 * Nested batches are transparent - only the outermost batch triggers flush.
 *
 * @param fn - The function to execute in batch mode
 * @returns The return value of fn
 *
 * @example
 * ```typescript
 * const a = signal(1);
 * const b = signal(2);
 * const sum = computed(() => a() + b());
 *
 * effect(() => console.log(sum()));
 * // Prints: 3
 *
 * batch(() => {
 *   a.set(10);
 *   b.set(20);
 * });
 * // Prints: 30 (only once, not twice)
 * ```
 */
export function batch<T>(fn: () => T): T {
  incrementBatchDepth();
  try {
    return fn();
  } finally {
    decrementBatchDepth();
    if (_batchDepth === 0) {
      flush();
    }
  }
}
