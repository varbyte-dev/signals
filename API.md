# API Documentation

Complete API reference for @varbyte/signals-core.

## Table of Contents

- [Core Primitives](#core-primitives)
  - [signal()](#signal)
  - [computed()](#computed)
  - [effect()](#effect)
- [Utilities](#utilities)
  - [batch()](#batch)
  - [untracked()](#untracked)
- [Types](#types)
- [Advanced Usage](#advanced-usage)

---

## Core Primitives

### `signal()`

Creates a writable reactive signal.

```typescript
function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>
): WritableSignal<T>
```

#### Parameters

- **`initialValue: T`** - The initial value of the signal
- **`options?: SignalOptions<T>`** - Optional configuration
  - `equals?: (a: T, b: T) => boolean` - Custom equality function for change detection

#### Returns

`WritableSignal<T>` - A callable signal object with methods:

- **`signal()`** - Read the current value
- **`signal.set(value: T)`** - Set a new value
- **`signal.update(fn: (current: T) => T)`** - Update based on current value
- **`signal.peek()`** - Read without tracking dependencies

#### Behavior

- **Change detection:** Uses `Object.is` by default (can be customized with `equals` option)
- **Dependency tracking:** When called inside a computed or effect, creates a dependency
- **Notifications:** When value changes, all dependents are notified and marked as dirty
- **Synchronous:** Changes propagate immediately (unless inside `batch()`)

#### Examples

**Basic usage:**

```typescript
const count = signal(0);

console.log(count()); // 0
count.set(5);
console.log(count()); // 5
count.update(n => n + 1);
console.log(count()); // 6
```

**Custom equality:**

```typescript
interface Point { x: number; y: number; }

const point = signal<Point>({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y
});

point.set({ x: 0, y: 0 }); // No change notification (equal)
point.set({ x: 1, y: 0 }); // Change notification
```

**Object.is semantics:**

```typescript
const num = signal(NaN);
num.set(NaN); // No change (NaN === NaN via Object.is)

const zero = signal(0);
zero.set(-0); // Change detected (0 !== -0 via Object.is)
```

---

### `computed()`

Creates a computed value that derives from signals.

```typescript
function computed<T>(
  fn: () => T,
  options?: ComputedOptions<T>
): ReadonlySignal<T>
```

#### Parameters

- **`fn: () => T`** - Computation function that reads signals
- **`options?: ComputedOptions<T>`** - Optional configuration
  - `equals?: (a: T, b: T) => boolean` - Custom equality for memoization

#### Returns

`ReadonlySignal<T>` - A callable computed object with methods:

- **`computed()`** - Read the current value (triggers recomputation if needed)
- **`computed.peek()`** - Read without tracking dependencies

**Note:** Computed values are read-only and have no `set` or `update` methods.

#### Behavior

- **Lazy evaluation:** Only executes when the value is read
- **Memoization:** Caches result until dependencies change
- **Automatic tracking:** Dependencies are tracked during execution
- **Dynamic dependencies:** Tracks only signals read in the current execution
- **Glitch-free:** Handles diamond dependencies correctly
- **Error caching:** If computation throws, error is cached and re-thrown on subsequent reads until dependencies change

#### Examples

**Basic computed:**

```typescript
const firstName = signal('John');
const lastName = signal('Doe');
const fullName = computed(() => `${firstName()} ${lastName()}`);

console.log(fullName()); // "John Doe"
firstName.set('Jane');
console.log(fullName()); // "Jane Doe"
```

**Chained computeds:**

```typescript
const value = signal(10);
const doubled = computed(() => value() * 2);
const quadrupled = computed(() => doubled() * 2);

console.log(quadrupled()); // 40
value.set(5);
console.log(quadrupled()); // 20
```

**Conditional dependencies:**

```typescript
const toggle = signal(true);
const a = signal(1);
const b = signal(100);

const value = computed(() => {
  return toggle() ? a() : b();
});

console.log(value()); // 1
a.set(2); // Triggers recomputation
console.log(value()); // 2

b.set(200); // Does NOT trigger (b not tracked when toggle is true)

toggle.set(false);
console.log(value()); // 200 (now tracking b)
b.set(300); // Now triggers recomputation
console.log(value()); // 300
```

**Error caching:**

```typescript
const num = signal(-1);
const sqrt = computed(() => {
  const n = num();
  if (n < 0) throw new Error('Negative number');
  return Math.sqrt(n);
});

try {
  sqrt(); // Throws
} catch (e) {
  console.log('First call:', e.message);
}

try {
  sqrt(); // Re-throws cached error WITHOUT re-execution
} catch (e) {
  console.log('Second call:', e.message);
}

num.set(4); // Clears cached error
console.log(sqrt()); // 2 (recomputed successfully)
```

**Custom equality:**

```typescript
interface Vector { x: number; y: number; }

const a = signal<Vector>({ x: 1, y: 2 });
const b = signal<Vector>({ x: 3, y: 4 });

const sum = computed(() => ({
  x: a().x + b().x,
  y: a().y + b().y
}), {
  equals: (a, b) => a.x === b.x && a.y === b.y
});

const prev = sum();
a.set({ x: 1, y: 2 }); // Same value
console.log(sum() === prev); // true (memoized due to custom equality)
```

---

### `effect()`

Creates a side effect that runs when dependencies change.

```typescript
function effect(
  fn: () => void | (() => void)
): EffectHandle
```

#### Parameters

- **`fn: () => void | (() => void)`** - Effect function, optionally returns cleanup function

#### Returns

`EffectHandle` - Handle for disposal with:

- **`dispose()`** - Manually stop the effect and run cleanup
- **`[Symbol.dispose]`** - ES2022 disposable symbol for `using` keyword

#### Behavior

- **Immediate execution:** Runs immediately when created
- **Automatic re-execution:** Runs when any tracked dependency changes
- **Dependency tracking:** Dependencies are tracked during execution
- **Cleanup support:** Returned function runs before next execution or disposal
- **Dynamic dependencies:** Only tracks signals read in the current execution
- **Error handling:** Errors propagate but don't stop the effect (it remains active)

#### Examples

**Basic effect:**

```typescript
const count = signal(0);

effect(() => {
  console.log(`Count: ${count()}`);
});
// Immediately prints: Count: 0

count.set(1);
// Prints: Count: 1
```

**With cleanup:**

```typescript
const url = signal('https://api.example.com/data');

effect(() => {
  const controller = new AbortController();
  
  fetch(url(), { signal: controller.signal })
    .then(res => res.json())
    .then(data => console.log(data));
  
  // Cleanup: abort fetch when url changes or effect disposes
  return () => {
    controller.abort();
  };
});
```

**Manual disposal:**

```typescript
const timer = signal(0);

const handle = effect(() => {
  console.log(`Timer: ${timer()}`);
});

const interval = setInterval(() => {
  timer.update(n => n + 1);
}, 1000);

// Later: stop the effect
setTimeout(() => {
  handle.dispose();
  clearInterval(interval);
}, 5000);
```

**Using disposable symbol:**

```typescript
const count = signal(0);

function trackCount() {
  using handle = effect(() => {
    console.log(`Count: ${count()}`);
  });
  
  // Effect automatically disposed when handle goes out of scope
}

trackCount();
// Effect is now disposed
```

**Conditional dependencies:**

```typescript
const mode = signal<'manual' | 'auto'>('manual');
const manualValue = signal(0);
const autoValue = signal(100);

effect(() => {
  const m = mode();
  const value = m === 'manual' ? manualValue() : autoValue();
  console.log(`Value: ${value}`);
});

manualValue.set(5); // Triggers effect
autoValue.set(200); // Does NOT trigger (not tracked in manual mode)

mode.set('auto'); // Triggers effect, now tracks autoValue
autoValue.set(300); // Now triggers effect
manualValue.set(10); // Does NOT trigger (no longer tracked)
```

**Error handling:**

```typescript
const num = signal(0);

effect(() => {
  const n = num();
  if (n < 0) {
    throw new Error('Negative value!');
  }
  console.log(`Valid: ${n}`);
});

num.set(5); // Prints: Valid: 5
num.set(-1); // Throws error, but effect remains active
num.set(10); // Prints: Valid: 10 (effect still works after error)
```

---

## Utilities

### `batch()`

Groups multiple signal writes into a single update cycle.

```typescript
function batch<T>(fn: () => T): T
```

#### Parameters

- **`fn: () => T`** - Function to execute in batch mode

#### Returns

The return value of `fn`

#### Behavior

- **Deferred updates:** Effects don't run until batch completes
- **Nested batches:** Inner batches are transparent (flush happens at outermost level)
- **Error handling:** Effects run even if batch function throws
- **Return value:** Forwards the return value of the batch function

#### Examples

**Basic batching:**

```typescript
const x = signal(1);
const y = signal(2);
const sum = computed(() => x() + y());

effect(() => console.log(`Sum: ${sum()}`));
// Prints: Sum: 3

batch(() => {
  x.set(10);
  y.set(20);
});
// Prints: Sum: 30 (only once, not twice)
```

**Nested batches:**

```typescript
const a = signal(0);
const b = signal(0);

effect(() => console.log(`a=${a()}, b=${b()}`));
// Prints: a=0, b=0

batch(() => {
  a.set(1);
  batch(() => {
    b.set(2);
  });
});
// Prints: a=1, b=2 (single flush after outermost batch)
```

**With return value:**

```typescript
const count = signal(0);

const result = batch(() => {
  count.set(5);
  count.set(10);
  return count() * 2;
});

console.log(result); // 20
```

**Error handling:**

```typescript
const count = signal(0);

effect(() => console.log(`Count: ${count()}`));

try {
  batch(() => {
    count.set(5);
    throw new Error('Batch failed!');
  });
} catch (e) {
  console.log('Caught:', e.message);
}
// Effect still runs: Prints "Count: 5"
```

---

### `untracked()`

Executes a function without tracking signal reads as dependencies.

```typescript
function untracked<T>(fn: () => T): T
```

#### Parameters

- **`fn: () => T`** - Function to execute without tracking

#### Returns

The return value of `fn`

#### Behavior

- **Suspends tracking:** Signal reads inside `fn` are not tracked
- **Nested untracked:** Can be nested (tracking remains suspended)
- **Return value:** Forwards the return value of the function
- **No side effects:** Doesn't affect writes or notifications

#### Examples

**Basic untracked:**

```typescript
const temperature = signal(20);
const unit = signal('C');

const display = computed(() => {
  const temp = temperature();
  const u = untracked(() => unit()); // Read unit without tracking
  
  return u === 'F' ? `${temp * 9/5 + 32}°F` : `${temp}°C`;
});

console.log(display()); // "20°C"
unit.set('F'); // Does NOT trigger recomputation
console.log(display()); // "20°C" (still shows Celsius, cached)
temperature.set(25); // Triggers recomputation (uses current unit)
console.log(display()); // "77°F" (now uses Fahrenheit)
```

**In effects:**

```typescript
const data = signal('initial');
const metadata = signal({ timestamp: Date.now() });

effect(() => {
  console.log(`Data: ${data()}`);
  
  // Read metadata without creating dependency
  const meta = untracked(() => metadata());
  console.log(`Timestamp: ${meta.timestamp}`);
});

data.set('updated'); // Triggers effect
metadata.set({ timestamp: Date.now() }); // Does NOT trigger effect
```

**Nested untracked:**

```typescript
const a = signal(1);
const b = signal(2);
const c = signal(3);

const result = computed(() => {
  const valA = a(); // Tracked
  
  return untracked(() => {
    const valB = b(); // Not tracked
    
    return untracked(() => {
      const valC = c(); // Still not tracked
      return valA + valB + valC;
    });
  });
});

a.set(10); // Triggers recomputation
b.set(20); // Does NOT trigger
c.set(30); // Does NOT trigger
```

---

## Types

### `SignalOptions<T>`

Configuration options for `signal()`.

```typescript
interface SignalOptions<T> {
  equals?: (a: T, b: T) => boolean;
}
```

### `ComputedOptions<T>`

Configuration options for `computed()`.

```typescript
interface ComputedOptions<T> {
  equals?: (a: T, b: T) => boolean;
}
```

### `WritableSignal<T>`

Type of a writable signal.

```typescript
interface WritableSignal<T> {
  (): T;
  set(value: T): void;
  update(fn: (current: T) => T): void;
  peek(): T;
}
```

### `ReadonlySignal<T>`

Type of a read-only signal (computeds).

```typescript
interface ReadonlySignal<T> {
  (): T;
  peek(): T;
}
```

### `EffectHandle`

Handle for effect disposal.

```typescript
interface EffectHandle {
  dispose(): void;
  [Symbol.dispose](): void;
}
```

---

## Advanced Usage

### Diamond Dependencies

Diamond dependencies are handled automatically without glitches:

```typescript
const source = signal(1);
const left = computed(() => source() * 2);
const right = computed(() => source() * 3);
const result = computed(() => left() + right());

effect(() => {
  console.log(`Result: ${result()}`);
});
// Prints: Result: 5 (2 + 3)

source.set(2);
// Prints: Result: 10 (4 + 6)
// Each computed executes exactly once (no glitches)
```

### Memory Management

Effects and computeds clean up automatically:

```typescript
// Dispose effects when done
const handle = effect(() => {
  // Effect body
});
handle.dispose(); // Unsubscribes from all dependencies

// Computeds with no consumers don't hold references
const temp = signal(20);
const doubled = computed(() => temp() * 2); // Created
// If doubled is never read and goes out of scope, it can be GC'd
```

### Error Handling

Errors in computeds are cached:

```typescript
const divisor = signal(0);
const result = computed(() => {
  const d = divisor();
  if (d === 0) throw new Error('Division by zero');
  return 100 / d;
});

try { result(); } catch (e) { /* First execution */ }
try { result(); } catch (e) { /* Re-throws cached error */ }

divisor.set(2); // Clears error cache
console.log(result()); // 50 (recomputed)
```

### Performance Tips

1. **Use `batch()` for multiple updates:**
   ```typescript
   batch(() => {
     x.set(1);
     y.set(2);
     z.set(3);
   }); // Single update cycle
   ```

2. **Use `peek()` to avoid tracking:**
   ```typescript
   const c = computed(() => {
     const tracked = dependency();
     const notTracked = other.peek(); // No dependency
     return tracked + notTracked;
   });
   ```

3. **Dispose unused effects:**
   ```typescript
   const handle = effect(() => { /* ... */ });
   // When done:
   handle.dispose();
   ```

4. **Use custom equality for expensive comparisons:**
   ```typescript
   const data = signal(largeArray, {
     equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
   });
   ```

5. **Avoid creating signals/computeds in loops:**
   ```typescript
   // Bad
   for (let i = 0; i < 1000; i++) {
     const s = signal(i); // Creates 1000 signals
   }
   
   // Good
   const items = signal(Array.from({ length: 1000 }, (_, i) => i));
   ```
