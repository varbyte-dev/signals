/**
 * Signal implementation - writable reactive primitives.
 */

import type { Node } from './node.js';
import { link } from './node.js';
import { _currentConsumer, incrementGlobalVersion } from './context.js';
import type { SignalOptions, WritableSignal } from './types.js';
import { scheduleEffect } from './batch.js';
import { untracked } from './untracked.js';

/**
 * Internal signal node structure.
 */
export interface SignalNode<T> {
  _value: T;
  _version: number;
  _targets: Node | null;
  _equals: (a: T, b: T) => boolean;
}

/**
 * Default equality function using Object.is semantics.
 */
const defaultEquals = <T>(a: T, b: T): boolean => Object.is(a, b);

/**
 * Notify all consumers that this signal has changed.
 * Pushes invalidation down the dependency graph.
 */
function notify<T>(signal: SignalNode<T>): void {
  incrementGlobalVersion();
  signal._version++;

  let node = signal._targets;
  while (node !== null) {
    const target = node._target;

    // Mark target as dirty if not already
    if (target._state < 2 /* DIRTY */) {
      target._state = 2; // DIRTY

      // Schedule effects, propagate to computeds
      if ('_fn' in target && !('_error' in target)) {
        // This is an effect (has _fn but no _error)
        scheduleEffect(target);
      } else if ('_error' in target) {
        // This is a computed - propagate CHECK state to its consumers
        propagate(target);
      }
    }

    node = node._nextSource;
  }
}

/**
 * Propagate CHECK state to indirect consumers.
 * Called when a computed's value MAY have changed.
 */
function propagate(computed: any): void {
  let node = computed._targets;
  while (node !== null) {
    const target = node._target;

    if (target._state < 1 /* CHECK */) {
      target._state = 1; // CHECK

      if ('_fn' in target && !('_error' in target)) {
        // Effect
        scheduleEffect(target);
      } else if ('_error' in target) {
        // Computed
        propagate(target);
      }
    }

    node = node._nextSource;
  }
}


/**
 * Create a writable reactive signal.
 *
 * @param initialValue - The initial value
 * @param options - Optional configuration
 * @returns A writable signal
 *
 * @example
 * ```typescript
 * const count = signal(0);
 * console.log(count()); // 0
 * count.set(5);
 * console.log(count()); // 5
 * count.update(n => n + 1);
 * console.log(count()); // 6
 * ```
 */
export function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T> {
  const node: SignalNode<T> = {
    _value: initialValue,
    _version: 0,
    _targets: null,
    _equals: options?.equals ?? defaultEquals,
  };

  // Read function - returns current value and tracks dependency
  const read = (): T => {
    // If we're inside a computed/effect, register dependency
    if (_currentConsumer !== null) {
      const depNode = link(node, _currentConsumer);
      depNode._version = node._version;
    }
    return node._value;
  };

  // Set function - update value if different
  const set = (value: T): void => {
    if (node._equals(node._value, value)) {
      return; // No change
    }
    node._value = value;
    notify(node);
  };

  // Update function - transform current value
  const update = (fn: (current: T) => T): void => {
    set(fn(node._value));
  };

  // Peek function - read without tracking
  const peek = (): T => {
    return untracked(() => read());
  };

  // Attach methods to read function
  (read as any).set = set;
  (read as any).update = update;
  (read as any).peek = peek;

  return read as WritableSignal<T>;
}
