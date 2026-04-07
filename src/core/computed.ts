/**
 * Computed implementation - lazy, memoized derived values.
 */

import type { Node } from './node.js';
import { link, unlink } from './node.js';
import {
  _currentConsumer,
  _globalVersion,
  setCurrentConsumer,
} from './context.js';
import type { ComputedOptions, ReadonlySignal } from './types.js';
import type { SignalNode } from './signal.js';

/**
 * Computed state enum.
 * CLEAN: value is up-to-date
 * CHECK: a transitive dependency may have changed, needs verification
 * DIRTY: a dependency has changed, must recompute
 */
export const enum ComputedState {
  CLEAN = 0,
  CHECK = 1,
  DIRTY = 2,
}

/**
 * Internal computed node structure.
 */
export interface ComputedNode<T> {
  _fn: () => T;
  _value: T | undefined;
  _error: unknown | undefined;
  _state: ComputedState;
  _version: number;
  _globalVersion: number;
  _sources: Node | null;
  _targets: Node | null;
  _equals: (a: T, b: T) => boolean;
}

/**
 * Default equality function using Object.is semantics.
 */
const defaultEquals = <T>(a: T, b: T): boolean => Object.is(a, b);

/**
 * Execute a computation function with dependency tracking.
 * Sets up the execution context, tracks new dependencies,
 * and removes stale dependencies.
 */
function execute<T>(computed: ComputedNode<T>): T {
  const prevConsumer = _currentConsumer;
  setCurrentConsumer(computed);

  // Mark all existing dependencies as potentially stale
  let node = computed._sources;
  while (node !== null) {
    node._version = -1;
    node._rollback = node;
    node = node._nextTarget;
  }

  try {
    const result = computed._fn();
    computed._value = result;
    computed._error = undefined;
    return result;
  } catch (error) {
    computed._value = undefined;
    computed._error = error;
    throw error;
  } finally {
    // Remove stale dependencies (still marked -1)
    node = computed._sources;
    while (node !== null) {
      const next = node._nextTarget;
      if (node._version === -1) {
        unlink(node);
      }
      node = next;
    }

    setCurrentConsumer(prevConsumer);
  }
}

/**
 * Recompute a computed value if needed.
 * Implements the three-state revalidation logic.
 */
function recompute<T>(computed: ComputedNode<T>): void {
  // Fast-path: if global version unchanged, nothing in system has changed
  if (computed._globalVersion === _globalVersion) {
    return;
  }

  computed._globalVersion = _globalVersion;

  // If CHECK state, verify dependencies
  if (computed._state === ComputedState.CHECK) {
    let node = computed._sources;
    let dirty = false;

    while (node !== null) {
      const source = node._source;

      // If source is a computed, recursively revalidate it
      if ('_error' in source) {
        recompute(source as ComputedNode<any>);
      }

      // Check if source version changed
      if (node._version !== source._version) {
        dirty = true;
        break;
      }

      node = node._nextTarget;
    }

    if (!dirty) {
      // All dependencies verified unchanged
      computed._state = ComputedState.CLEAN;
      return;
    }

    // At least one dependency changed
    computed._state = ComputedState.DIRTY;
  }

  // State is DIRTY - must recompute
  if (computed._state === ComputedState.DIRTY) {
    const prevValue = computed._value;
    const hadError = computed._error !== undefined;

    try {
      const newValue = execute(computed);

      // Check if value actually changed (via equality)
      if (!hadError && computed._equals(prevValue as T, newValue)) {
        // Value unchanged - don't increment version
        // This prevents downstream recomputation
      } else {
        // Value changed - increment version
        computed._version++;
      }
    } catch (error) {
      // Error occurred - increment version (error is a state change)
      computed._version++;
    }

    computed._state = ComputedState.CLEAN;
  }
}

/**
 * Create a read-only computed signal.
 *
 * @param fn - The computation function
 * @param options - Optional configuration
 * @returns A read-only signal
 *
 * @example
 * ```typescript
 * const count = signal(5);
 * const double = computed(() => count() * 2);
 * console.log(double()); // 10
 * count.set(10);
 * console.log(double()); // 20
 * ```
 */
export function computed<T>(
  fn: () => T,
  options?: ComputedOptions<T>,
): ReadonlySignal<T> {
  const node: ComputedNode<T> = {
    _fn: fn,
    _value: undefined,
    _error: undefined,
    _state: ComputedState.DIRTY, // Not yet computed
    _version: 0,
    _globalVersion: -1, // Never seen any writes
    _sources: null,
    _targets: null,
    _equals: options?.equals ?? defaultEquals,
  };

  // Read function - revalidates and returns value
  const read = (): T => {
    // Recompute if needed
    recompute(node);

    // If we're inside another computed/effect, register dependency
    if (_currentConsumer !== null) {
      const depNode = link(node, _currentConsumer);
      depNode._version = node._version;
    }

    // If computation threw, re-throw the cached error
    if (node._error !== undefined) {
      throw node._error;
    }

    return node._value as T;
  };

  return read as ReadonlySignal<T>;
}
