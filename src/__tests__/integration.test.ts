/**
 * Integration tests - full reactive system
 */

import { describe, test, expect } from 'vitest';
import { signal, computed, effect, batch, untracked } from '../index.js';

describe('integration', () => {
  test('complex reactive graph', () => {
    const firstName = signal('John');
    const lastName = signal('Doe');
    const fullName = computed(() => `${firstName()} ${lastName()}`);
    const greeting = computed(() => `Hello, ${fullName()}!`);

    let greetings: string[] = [];
    effect(() => {
      greetings.push(greeting());
    });

    expect(greetings).toEqual(['Hello, John Doe!']);

    firstName.set('Jane');
    expect(greetings).toEqual(['Hello, John Doe!', 'Hello, Jane Doe!']);

    lastName.set('Smith');
    expect(greetings).toEqual([
      'Hello, John Doe!',
      'Hello, Jane Doe!',
      'Hello, Jane Smith!',
    ]);
  });

  test('todo list with computed filtering', () => {
    interface Todo {
      id: number;
      text: string;
      done: boolean;
    }

    const todos = signal<Todo[]>([
      { id: 1, text: 'Buy milk', done: false },
      { id: 2, text: 'Walk dog', done: true },
      { id: 3, text: 'Write code', done: false },
    ]);

    const filter = signal<'all' | 'active' | 'completed'>('all');

    const filteredTodos = computed(() => {
      const f = filter();
      const t = todos();

      if (f === 'active') return t.filter((todo) => !todo.done);
      if (f === 'completed') return t.filter((todo) => todo.done);
      return t;
    });

    const activeCount = computed(() => todos().filter((t) => !t.done).length);

    expect(filteredTodos()).toHaveLength(3);
    expect(activeCount()).toBe(2);

    filter.set('active');
    expect(filteredTodos()).toHaveLength(2);
    expect(filteredTodos()[0]?.text).toBe('Buy milk');

    filter.set('completed');
    expect(filteredTodos()).toHaveLength(1);
    expect(filteredTodos()[0]?.text).toBe('Walk dog');

    // Mark one as done
    todos.update((t) => [
      { ...t[0]!, done: true },
      t[1]!,
      t[2]!,
    ]);

    expect(activeCount()).toBe(1);
    filter.set('completed');
    expect(filteredTodos()).toHaveLength(2);
  });

  test('effect cleanup with event listeners pattern', () => {
    const elementId = signal('button1');
    const clicks: string[] = [];

    interface Listener {
      id: string;
      handler: () => void;
      remove: () => void;
    }

    const mockAddEventListener = (id: string, handler: () => void): Listener => ({
      id,
      handler,
      remove: () => clicks.push(`removed:${id}`),
    });

    let currentListener: Listener | null = null;

    const handle = effect(() => {
      const id = elementId();
      const listener = mockAddEventListener(id, () => clicks.push(`click:${id}`));
      currentListener = listener;

      return () => {
        listener.remove();
        currentListener = null;
      };
    });

    expect(currentListener!.id).toBe('button1');

    // Simulate click
    currentListener!.handler();
    expect(clicks).toEqual(['click:button1']);

    // Change element ID - should cleanup old listener
    elementId.set('button2');
    expect(clicks).toEqual(['click:button1', 'removed:button1']);
    expect(currentListener!.id).toBe('button2');

    // Cleanup on disposal
    handle.dispose();
    expect(clicks).toEqual(['click:button1', 'removed:button1', 'removed:button2']);
  });

  test('batch with multiple computeds and effects', () => {
    const x = signal(1);
    const y = signal(2);
    const sum = computed(() => x() + y());
    const product = computed(() => x() * y());

    const results: string[] = [];
    effect(() => {
      results.push(`sum=${sum()}`);
    });
    effect(() => {
      results.push(`product=${product()}`);
    });

    expect(results).toEqual(['sum=3', 'product=2']);

    batch(() => {
      x.set(10);
      y.set(20);
    });

    // Both effects run once, not twice
    expect(results).toHaveLength(4); // Initial 2 + batch 2
    expect(results).toContain('sum=30');
    expect(results).toContain('product=200');
  });

  test('conditional computed with untracked reads', () => {
    const temperature = signal(20);
    const unit = signal<'C' | 'F'>('C');

    const display = computed(() => {
      const temp = temperature();
      const u = untracked(() => unit()); // Unit doesn't trigger recomputation

      if (u === 'F') {
        return `${(temp * 9) / 5 + 32}°F`;
      }
      return `${temp}°C`;
    });

    let displayRuns = 0;
    effect(() => {
      displayRuns++;
      display();
    });

    expect(display()).toBe('20°C');
    expect(displayRuns).toBe(1);

    // Changing unit doesn't trigger recomputation (untracked)
    unit.set('F');
    expect(display()).toBe('20°C'); // Still cached with old unit
    expect(displayRuns).toBe(1);

    // Changing temperature triggers recomputation with current unit
    temperature.set(25);
    expect(display()).toBe('77°F');
    expect(displayRuns).toBe(2);
  });

  test('nested computeds with diamond dependency', () => {
    const value = signal(10);

    const doubled = computed(() => value() * 2);
    const tripled = computed(() => value() * 3);

    const combined1 = computed(() => doubled() + tripled());
    const combined2 = computed(() => doubled() * tripled());

    const final = computed(() => combined1() + combined2());

    expect(final()).toBe(650); // (20 + 30) + (20 * 30) = 50 + 600

    value.set(5);
    expect(doubled()).toBe(10); // 5 * 2
    expect(tripled()).toBe(15); // 5 * 3
    expect(combined1()).toBe(25); // 10 + 15
    expect(combined2()).toBe(150); // 10 * 15
    expect(final()).toBe(175); // 25 + 150
  });

  test('effect with dynamic dependencies', () => {
    const mode = signal<'manual' | 'auto'>('manual');
    const manualValue = signal(0);
    const autoValue = signal(100);

    const values: number[] = [];
    effect(() => {
      const m = mode();
      values.push(m === 'manual' ? manualValue() : autoValue());
    });

    expect(values).toEqual([0]); // Initial: manual mode, manualValue=0

    manualValue.set(5);
    expect(values).toEqual([0, 5]); // Tracked

    autoValue.set(200);
    expect(values).toEqual([0, 5]); // Not tracked in manual mode

    mode.set('auto');
    expect(values).toEqual([0, 5, 200]); // Switched to auto, now tracking autoValue

    autoValue.set(300);
    expect(values).toEqual([0, 5, 200, 300]); // Tracked

    manualValue.set(10);
    expect(values).toEqual([0, 5, 200, 300]); // No longer tracking manualValue
  });

  test('complex state machine', () => {
    type State = 'idle' | 'loading' | 'success' | 'error';

    const state = signal<State>('idle');
    const data = signal<string | null>(null);
    const error = signal<string | null>(null);

    const isLoading = computed(() => state() === 'loading');
    const hasData = computed(() => state() === 'success' && data() !== null);
    const hasError = computed(() => state() === 'error' && error() !== null);

    const statusMessage = computed(() => {
      if (isLoading()) return 'Loading...';
      if (hasData()) return `Data: ${data()}`;
      if (hasError()) return `Error: ${error()}`;
      return 'Idle';
    });

    const messages: string[] = [];
    effect(() => {
      messages.push(statusMessage());
    });

    expect(messages).toEqual(['Idle']);

    // Start loading
    batch(() => {
      state.set('loading');
      data.set(null);
      error.set(null);
    });
    expect(messages).toEqual(['Idle', 'Loading...']);

    // Success
    batch(() => {
      state.set('success');
      data.set('Hello World');
    });
    expect(messages).toEqual(['Idle', 'Loading...', 'Data: Hello World']);

    // Error
    batch(() => {
      state.set('error');
      data.set(null);
      error.set('Network timeout');
    });
    expect(messages).toEqual([
      'Idle',
      'Loading...',
      'Data: Hello World',
      'Error: Network timeout',
    ]);

    // Back to idle
    batch(() => {
      state.set('idle');
      error.set(null);
    });
    expect(messages).toEqual([
      'Idle',
      'Loading...',
      'Data: Hello World',
      'Error: Network timeout',
      'Idle',
    ]);
  });
});
