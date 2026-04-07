/**
 * Effect implementation - reactive side effects.
 */

import type { Node } from './node.js';
import { unlink } from './node.js';
import { _currentConsumer, setCurrentConsumer } from './context.js';
import type { EffectHandle } from './types.js';
import { ComputedState } from './computed.js';

/**
 * Internal effect node structure.
 */
export interface EffectNode {
  _fn: () => void | (() => void);
  _cleanup: (() => void) | undefined;
  _sources: Node | null;
  _state: ComputedState;
  _disposed: boolean;
  _nextEffect: EffectNode | null;
}

/**
 * Execute an effect's function with dependency tracking.
 */
function executeEffect(effect: EffectNode): void {
  if (effect._disposed) {
    return;
  }

  // Run cleanup from previous execution
  if (effect._cleanup !== undefined) {
    effect._cleanup();
    effect._cleanup = undefined;
  }

  const prevConsumer = _currentConsumer;
  setCurrentConsumer(effect);

  // Mark all existing dependencies as potentially stale
  let node = effect._sources;
  while (node !== null) {
    node._version = -1;
    node = node._nextTarget;
  }

  try {
    const result = effect._fn();
    if (typeof result === 'function') {
      effect._cleanup = result;
    }
  } finally {
    // Remove stale dependencies
    node = effect._sources;
    while (node !== null) {
      const next = node._nextTarget;
      if (node._version === -1) {
        unlink(node);
      }
      node = next;
    }

    setCurrentConsumer(prevConsumer);
  }

  effect._state = ComputedState.CLEAN;
}

/**
 * Create a reactive effect.
 * The effect executes immediately and re-executes when dependencies change.
 *
 * @param fn - The effect function. Can return a cleanup function.
 * @returns An effect handle for disposal
 *
 * @example
 * ```typescript
 * const count = signal(0);
 * const handle = effect(() => {
 *   console.log('Count:', count());
 *   return () => console.log('Cleanup');
 * });
 * // Prints: Count: 0
 *
 * count.set(1);
 * // Prints: Cleanup
 * // Prints: Count: 1
 *
 * handle.dispose();
 * // Prints: Cleanup
 * ```
 */
export function effect(fn: () => void | (() => void)): EffectHandle {
  const node: EffectNode = {
    _fn: fn,
    _cleanup: undefined,
    _sources: null,
    _state: ComputedState.DIRTY,
    _disposed: false,
    _nextEffect: null,
  };

  // Execute immediately
  executeEffect(node);

  // Create disposal handle
  const dispose = (): void => {
    if (node._disposed) {
      return;
    }

    node._disposed = true;

    // Run cleanup
    if (node._cleanup !== undefined) {
      node._cleanup();
      node._cleanup = undefined;
    }

    // Unlink all dependencies
    let dep = node._sources;
    while (dep !== null) {
      const next = dep._nextTarget;
      unlink(dep);
      dep = next;
    }

    node._sources = null;
  };

  const handle: EffectHandle = {
    dispose,
    [Symbol.dispose]: dispose,
  };

  return handle;
}

// Export for batch module
export { executeEffect };
