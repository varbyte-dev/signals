/**
 * Equality function for custom value comparison.
 * @returns true if values should be considered equal
 */
export type EqualsFn<T> = (a: T, b: T) => boolean;

/**
 * Options for signal() factory.
 */
export interface SignalOptions<T> {
  /**
   * Custom equality function. Defaults to Object.is.
   * Used to determine if a new value is different from the current value.
   */
  equals?: EqualsFn<T>;
}

/**
 * Options for computed() factory.
 */
export interface ComputedOptions<T> {
  /**
   * Custom equality function. Defaults to Object.is.
   * Used to determine if a recomputed value changed, preventing unnecessary propagation.
   */
  equals?: EqualsFn<T>;
}

/**
 * A readable reactive value.
 * Calling the function returns the current value and registers a dependency
 * if called within a computed or effect context.
 */
export interface ReadonlySignal<T> {
  (): T;
}

/**
 * A writable reactive value.
 * Extends ReadonlySignal with mutation methods.
 */
export interface WritableSignal<T> extends ReadonlySignal<T> {
  /**
   * Set a new value.
   * If the new value is equal to the current value (via equals function),
   * no update occurs and dependents are not notified.
   */
  set(value: T): void;

  /**
   * Update the value based on the current value.
   * The update function receives the current value and returns the new value.
   */
  update(fn: (current: T) => T): void;

  /**
   * Read the current value without registering a dependency.
   * Equivalent to untracked(() => signal()).
   */
  peek(): T;
}

/**
 * Type alias for WritableSignal - the return type of signal().
 */
export type Signal<T> = WritableSignal<T>;

/**
 * Type alias for ReadonlySignal - the return type of computed().
 */
export type Computed<T> = ReadonlySignal<T>;

/**
 * Handle returned by effect() for lifecycle control.
 */
export interface EffectHandle {
  /**
   * Stop the effect and run its cleanup callback (if any).
   * After disposal, the effect will not re-execute when dependencies change.
   */
  dispose(): void;

  /**
   * ES2023 Disposable protocol support.
   * Enables usage with the `using` keyword for automatic cleanup.
   */
  [Symbol.dispose](): void;
}
