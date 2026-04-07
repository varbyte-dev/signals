/**
 * @varbyte/signals-core
 * Framework-agnostic reactive signals library
 */

// Primitive factories
export { signal } from './core/signal.js';
export { computed } from './core/computed.js';
export { effect } from './core/effect.js';

// Utilities
export { batch } from './core/batch.js';
export { untracked } from './core/untracked.js';

// Type definitions
export type {
  Signal,
  Computed,
  ReadonlySignal,
  WritableSignal,
  EffectHandle,
  SignalOptions,
  ComputedOptions,
  EqualsFn,
} from './core/types.js';
