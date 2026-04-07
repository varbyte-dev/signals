/**
 * Global execution context for the reactive system.
 * Module-scoped state that tracks the current execution context
 * and manages batching/scheduling.
 */

import type { ComputedNode } from './computed.js';
import type { EffectNode } from './effect.js';

/**
 * The currently executing consumer (computed or effect).
 * Set to non-null during execution to enable automatic dependency tracking.
 */
export let _currentConsumer: ComputedNode<any> | EffectNode | null = null;

/**
 * Global version counter, incremented on any signal write.
 * Used for fast-path optimization in computed revalidation.
 */
export let _globalVersion = 0;

/**
 * Batch depth counter for nested batch() calls.
 * Effects only flush when this returns to 0.
 */
export let _batchDepth = 0;

/**
 * Head of the pending effects queue (intrusive linked list).
 */
export let _pendingEffects: EffectNode | null = null;

/**
 * Tail of the pending effects queue for O(1) append.
 */
export let _lastPendingEffect: EffectNode | null = null;

/**
 * Batch iteration counter for cycle detection.
 * Reset at the start of each flush, incremented per flush loop.
 * Throws if exceeds 100 (indicates infinite effect loop).
 */
export let _batchIteration = 0;

// === Mutators (used by core modules) ===

export function setCurrentConsumer(consumer: ComputedNode<any> | EffectNode | null): void {
  _currentConsumer = consumer;
}

export function incrementGlobalVersion(): void {
  _globalVersion++;
}

export function incrementBatchDepth(): void {
  _batchDepth++;
}

export function decrementBatchDepth(): void {
  _batchDepth--;
}

export function setPendingEffects(effect: EffectNode | null): void {
  _pendingEffects = effect;
}

export function setLastPendingEffect(effect: EffectNode | null): void {
  _lastPendingEffect = effect;
}

export function resetBatchIteration(): void {
  _batchIteration = 0;
}

export function incrementBatchIteration(): void {
  _batchIteration++;
}
