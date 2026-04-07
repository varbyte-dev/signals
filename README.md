# @varbyte/signals-core

> Framework-agnostic reactive signals library with zero dependencies

A lightweight, high-performance reactive signals implementation inspired by Solid.js, Preact Signals, and Angular Signals. Built for modern JavaScript applications with full TypeScript support and automatic dependency tracking.

## Features

- ✅ **Zero dependencies** - Pure TypeScript implementation
- ✅ **Tiny bundle** - 1.4 KB minified + gzipped
- ✅ **Framework-agnostic** - Works with any framework or vanilla JS
- ✅ **TypeScript strict mode** - Full type safety with inference
- ✅ **Automatic dependency tracking** - No manual subscriptions needed
- ✅ **Glitch-free** - Diamond dependencies handled correctly
- ✅ **Memory efficient** - Automatic cleanup and node pooling
- ✅ **High performance** - Optimized for speed with lazy evaluation

## Installation

```bash
npm install @varbyte/signals-core
```

Or with your preferred package manager:

```bash
pnpm add @varbyte/signals-core
yarn add @varbyte/signals-core
bun add @varbyte/signals-core
```

## Quick Start

```typescript
import { signal, computed, effect } from '@varbyte/signals-core';

// Create a reactive signal
const count = signal(0);

// Create a computed value (automatically tracks dependencies)
const doubled = computed(() => count() * 2);

// Create an effect (runs immediately and when dependencies change)
effect(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});
// Prints: Count: 0, Doubled: 0

// Update the signal
count.set(5);
// Prints: Count: 5, Doubled: 10

// Update using current value
count.update(n => n + 1);
// Prints: Count: 6, Doubled: 12
```

## Core Concepts

### Signals

Signals are reactive containers for values. When you read a signal inside a computed or effect, it automatically tracks the dependency.

```typescript
const name = signal('John');

// Read a signal
console.log(name()); // "John"

// Write to a signal
name.set('Jane');

// Update based on current value
name.update(current => current.toUpperCase());

// Read without tracking (inside computed/effect)
const untracked = name.peek();
```

**Custom Equality:**

```typescript
const point = signal({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y
});

point.set({ x: 0, y: 0 }); // No update (equal by custom function)
```

### Computed

Computed values derive state from signals and other computeds. They're lazy (only recompute when read) and memoized (cache results until dependencies change).

```typescript
const firstName = signal('John');
const lastName = signal('Doe');
const fullName = computed(() => `${firstName()} ${lastName()}`);

console.log(fullName()); // "John Doe"

firstName.set('Jane');
console.log(fullName()); // "Jane Doe"
```

**Computed values are read-only** - they have no `set` or `update` methods.

### Effects

Effects are side effects that run when their dependencies change. They execute immediately on creation and re-run when any tracked signal changes.

```typescript
const count = signal(0);

const handle = effect(() => {
  console.log(`Count changed to: ${count()}`);
});
// Immediately prints: Count changed to: 0

count.set(1);
// Prints: Count changed to: 1

// Cleanup
handle.dispose();
```

**Effect Cleanup:**

```typescript
const elementId = signal('button1');

effect(() => {
  const id = elementId();
  const button = document.getElementById(id);
  
  const handler = () => console.log('Clicked!');
  button?.addEventListener('click', handler);
  
  // Cleanup function - runs before next execution or disposal
  return () => {
    button?.removeEventListener('click', handler);
  };
});
```

**Using Disposable Symbol:**

```typescript
using handle = effect(() => {
  // Effect body
});

// Automatically disposed when handle goes out of scope
```

### Batching

Batch multiple signal writes to prevent redundant computations:

```typescript
const x = signal(1);
const y = signal(2);
const sum = computed(() => x() + y());

effect(() => console.log(sum()));
// Prints: 3

batch(() => {
  x.set(10);
  y.set(20);
});
// Prints: 30 (only once, not twice)
```

### Untracked Reads

Read signals without creating dependencies:

```typescript
const temperature = signal(20);
const unit = signal('C');

const display = computed(() => {
  const temp = temperature();
  const u = untracked(() => unit()); // Doesn't track unit
  
  return u === 'F' ? `${temp * 9/5 + 32}°F` : `${temp}°C`;
});

unit.set('F'); // Doesn't trigger recomputation
temperature.set(25); // Triggers recomputation (uses current unit)
```

## API Reference

### `signal<T>(initialValue: T, options?: SignalOptions<T>): WritableSignal<T>`

Creates a writable reactive signal.

**Options:**
- `equals?: (a: T, b: T) => boolean` - Custom equality function (default: `Object.is`)

**Methods:**
- `signal()` - Read current value
- `signal.set(value)` - Set new value
- `signal.update(fn)` - Update based on current value
- `signal.peek()` - Read without tracking

### `computed<T>(fn: () => T, options?: ComputedOptions<T>): ReadonlySignal<T>`

Creates a computed value that derives from signals.

**Options:**
- `equals?: (a: T, b: T) => boolean` - Custom equality function

**Methods:**
- `computed()` - Read current value (triggers recomputation if needed)
- `computed.peek()` - Read without tracking

### `effect(fn: () => void | (() => void)): EffectHandle`

Creates a side effect that runs when dependencies change.

**Returns:**
- `EffectHandle` with `dispose()` method and `Symbol.dispose`

**Cleanup:**
- Return a cleanup function from the effect to run before next execution or disposal

### `batch<T>(fn: () => T): T`

Groups multiple signal writes into a single update cycle.

**Returns:** The return value of `fn`

### `untracked<T>(fn: () => T): T`

Executes a function without tracking signal reads as dependencies.

**Returns:** The return value of `fn`

## Examples

### Counter

```typescript
import { signal, computed, effect } from '@varbyte/signals-core';

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});

setInterval(() => {
  count.update(n => n + 1);
}, 1000);
```

### Todo List with Filtering

```typescript
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const todos = signal<Todo[]>([
  { id: 1, text: 'Buy milk', done: false },
  { id: 2, text: 'Walk dog', done: true },
]);

const filter = signal<'all' | 'active' | 'completed'>('all');

const filteredTodos = computed(() => {
  const f = filter();
  const t = todos();
  
  if (f === 'active') return t.filter(todo => !todo.done);
  if (f === 'completed') return t.filter(todo => todo.done);
  return t;
});

const activeCount = computed(() => 
  todos().filter(t => !t.done).length
);

effect(() => {
  console.log(`Showing ${filteredTodos().length} todos`);
  console.log(`${activeCount()} active`);
});
```

### Derived State

```typescript
const user = signal({
  firstName: 'John',
  lastName: 'Doe',
  age: 30
});

const fullName = computed(() => {
  const u = user();
  return `${u.firstName} ${u.lastName}`;
});

const isAdult = computed(() => user().age >= 18);

const greeting = computed(() => {
  const name = fullName();
  const adult = isAdult();
  return `Hello, ${name}! ${adult ? 'Welcome' : 'You must be 18+'}`;
});
```

## Performance

Benchmarks on a modern desktop (lower is better):

- **Signal reads:** ~13ms per 1M reads (~13ns each)
- **Signal writes (no deps):** ~1.6ms per 100K writes (~16ns each)
- **Computed recomputation:** ~17ms per 100K recomputations (~170ns each)
- **Effect execution:** ~3.3ms per 10K executions (~330ns each)
- **100-deep chain:** ~15ms per 1K updates
- **Wide fan-out (100 effects):** ~32ms per 1K updates
- **Batch (100 writes):** ~15ms per 1K batches

See `src/__tests__/benchmarks.bench.ts` for detailed benchmarks.

## Comparison with Other Libraries

| Feature | @varbyte/signals-core | Solid.js | Preact Signals | Angular Signals | Vue Composition |
|---------|----------------------|----------|----------------|-----------------|-----------------|
| Bundle Size (gzipped) | **1.4 KB** | ~3 KB | ~1.6 KB | N/A (framework) | N/A (framework) |
| Zero Dependencies | ✅ | ✅ | ✅ | ❌ | ❌ |
| Framework Agnostic | ✅ | ❌ (Solid-only) | ✅ | ❌ (Angular-only) | ❌ (Vue-only) |
| TypeScript Strict | ✅ | ✅ | ✅ | ✅ | ✅ |
| Automatic Tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Glitch-Free | ✅ | ✅ | ✅ | ✅ | ✅ |
| Symbol.dispose | ✅ | ❌ | ❌ | ❌ | ❌ |
| Custom Equality | ✅ | ✅ | ❌ | ✅ | ✅ |

## Browser Compatibility

- **Browsers:** Chrome, Firefox, Safari, Edge (ES2022+ support)
- **Node.js:** 18+
- **Deno:** 1.0+
- **Bun:** 1.0+

Requires ES2022 features:
- `Object.is`
- Arrow functions
- Optional chaining
- Nullish coalescing
- `Symbol.dispose` (optional, for `using` keyword)

## Architecture

This library implements the **push-pull** reactive model with a three-state system (CLEAN/CHECK/DIRTY) to handle diamond dependencies efficiently. Key design decisions:

- **Lazy evaluation:** Computeds only recompute when read
- **Memoization:** Results are cached until dependencies change
- **Node pooling:** Dependency nodes are reused to reduce GC pressure
- **Glitch-free:** Diamond dependencies resolve correctly without intermediate states
- **Error caching:** Computed errors are cached and re-thrown without re-execution

See the source code for implementation details.

## License

MIT © Varbyte

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Links

- [GitHub Repository](https://github.com/varbyte/signals)
- [npm Package](https://www.npmjs.com/package/@varbyte/signals-core)
- [API Documentation](./API.md)
