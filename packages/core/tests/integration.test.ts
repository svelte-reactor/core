/**
 * Integration tests - Testing multiple plugins working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { persist, undoRedo, logger } from '../src/plugins';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface TodoState {
  items: TodoItem[];
  filter: 'all' | 'active' | 'completed';
}

describe('Integration: All plugins together', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    } as Storage;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should work with persist + undoRedo + logger', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const todos = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        name: 'todos',
        plugins: [
          persist({ key: 'test-todos', debounce: 0 }),
          undoRedo({ limit: 50 }),
          logger({ collapsed: true }),
        ],
      }
    );

    // Add todo item
    todos.update((state) => {
      state.items.push({
        id: '1',
        text: 'Test todo',
        done: false,
      });
    });

    // Check state
    expect(todos.state.items.length).toBe(1);
    expect(todos.state.items[0].text).toBe('Test todo');

    // Check undo
    expect(todos.canUndo()).toBe(true);

    // Check logger was called
    expect(consoleSpy).toHaveBeenCalled();

    // Undo
    todos.undo();
    expect(todos.state.items.length).toBe(0);

    // Redo
    todos.redo();
    expect(todos.state.items.length).toBe(1);

    consoleSpy.mockRestore();
  });

  it('should persist state and allow undo/redo after reload', async () => {
    // Create first reactor and add items
    const todos1 = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        name: 'todos',
        plugins: [
          persist({ key: 'test-todos-reload', debounce: 0 }),
          undoRedo({ limit: 50 }),
        ],
      }
    );

    todos1.update((state) => {
      state.items.push({
        id: '1',
        text: 'Persisted todo',
        done: false,
      });
    });

    // Wait for persist
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check localStorage
    expect(localStorage.getItem('test-todos-reload')).toBeTruthy();

    // Simulate reload - create new reactor
    const todos2 = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        name: 'todos',
        plugins: [
          persist({ key: 'test-todos-reload', debounce: 0 }),
          undoRedo({ limit: 50 }),
        ],
      }
    );

    // State should be restored
    expect(todos2.state.items.length).toBe(1);
    expect(todos2.state.items[0].text).toBe('Persisted todo');

    // New changes should work
    todos2.update((state) => {
      state.items[0].done = true;
    });

    expect(todos2.state.items[0].done).toBe(true);
    expect(todos2.canUndo()).toBe(true);

    todos2.undo();
    expect(todos2.state.items[0].done).toBe(false);
  });

  it('should batch operations and persist once', async () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    const todos = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        plugins: [
          persist({ key: 'test-batch', debounce: 0 }),
          undoRedo({ limit: 50 }),
        ],
      }
    );

    // Batch multiple updates
    todos.batch(() => {
      todos.update((state) => {
        state.items.push({
          id: '1',
          text: 'Item 1',
          done: false,
        });
      });
      todos.update((state) => {
        state.items.push({
          id: '2',
          text: 'Item 2',
          done: false,
        });
      });
      todos.update((state) => {
        state.items.push({
          id: '3',
          text: 'Item 3',
          done: false,
        });
      });
    });

    expect(todos.state.items.length).toBe(3);

    // Should undo all 3 in one step
    todos.undo();
    expect(todos.state.items.length).toBe(0);

    // Wait for persist
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Persist should have been called (for batched updates)
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('should handle complex state with nested objects', () => {
    interface ComplexState {
      user: {
        name: string;
        settings: {
          theme: string;
          notifications: boolean;
        };
      };
      todos: TodoItem[];
    }

    const app = createReactor<ComplexState>(
      {
        user: {
          name: 'John',
          settings: {
            theme: 'light',
            notifications: true,
          },
        },
        todos: [],
      },
      {
        plugins: [
          persist({ key: 'test-complex', debounce: 0 }),
          undoRedo({ limit: 50 }),
        ],
      }
    );

    // Update nested property
    app.update((state) => {
      state.user.settings.theme = 'dark';
    });

    expect(app.state.user.settings.theme).toBe('dark');

    // Undo nested change
    app.undo();
    expect(app.state.user.settings.theme).toBe('light');

    // Update array
    app.update((state) => {
      state.todos.push({
        id: '1',
        text: 'Test',
        done: false,
      });
    });

    expect(app.state.todos.length).toBe(1);

    app.undo();
    expect(app.state.todos.length).toBe(0);
  });

  it('should clear history and not affect persist', async () => {
    const todos = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        plugins: [
          persist({ key: 'test-clear-history', debounce: 0 }),
          undoRedo({ limit: 50 }),
        ],
      }
    );

    // Add items
    todos.update((state) => {
      state.items.push({
        id: '1',
        text: 'Item 1',
        done: false,
      });
    });

    expect(todos.canUndo()).toBe(true);

    // Clear history
    todos.clearHistory();

    expect(todos.canUndo()).toBe(false);
    expect(todos.state.items.length).toBe(1); // State unchanged

    // Wait for persist
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Persist should still have the data
    expect(localStorage.getItem('test-clear-history')).toBeTruthy();
  });

  it('should handle plugin order independence', () => {
    // Order 1: persist, undo, logger
    const reactor1 = createReactor(
      { value: 0 },
      {
        plugins: [
          persist({ key: 'test-order-1', debounce: 0 }),
          undoRedo(),
          logger(),
        ],
      }
    );

    reactor1.update((state) => {
      state.value = 10;
    });

    expect(reactor1.state.value).toBe(10);
    expect(reactor1.canUndo()).toBe(true);

    // Order 2: logger, undo, persist
    const reactor2 = createReactor(
      { value: 0 },
      {
        plugins: [
          logger(),
          undoRedo(),
          persist({ key: 'test-order-2', debounce: 0 }),
        ],
      }
    );

    reactor2.update((state) => {
      state.value = 10;
    });

    expect(reactor2.state.value).toBe(10);
    expect(reactor2.canUndo()).toBe(true);

    // Both should work the same
    reactor1.undo();
    reactor2.undo();

    expect(reactor1.state.value).toBe(0);
    expect(reactor2.state.value).toBe(0);
  });

  it('should handle destroy with all plugins', async () => {
    const todos = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        plugins: [
          persist({ key: 'test-destroy', debounce: 0 }),
          undoRedo({ limit: 50 }),
          logger(),
        ],
      }
    );

    todos.update((state) => {
      state.items.push({
        id: '1',
        text: 'Test',
        done: false,
      });
    });

    // Wait for persist
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Destroy
    todos.destroy();

    // Updates should be ignored
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    todos.update((state) => {
      state.items.push({
        id: '2',
        text: 'Should not add',
        done: false,
      });
    });

    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0][0];
    expect(warnCall).toContain('Cannot update destroyed reactor');
    expect(todos.state.items.length).toBe(1);

    warnSpy.mockRestore();
  });
});

describe('Integration: Real-world scenarios', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    } as Storage;
  });

  it('should handle todo app workflow', async () => {
    const todos = createReactor<TodoState>(
      {
        items: [],
        filter: 'all',
      },
      {
        plugins: [
          persist({ key: 'todo-app', debounce: 0 }),
          undoRedo({ limit: 100 }),
        ],
      }
    );

    // Add todos
    todos.update((state) => {
      state.items.push({ id: '1', text: 'Buy milk', done: false });
    });

    todos.update((state) => {
      state.items.push({ id: '2', text: 'Write code', done: false });
    });

    todos.update((state) => {
      state.items.push({ id: '3', text: 'Go gym', done: false });
    });

    expect(todos.state.items.length).toBe(3);

    // Complete first todo
    todos.update((state) => {
      state.items[0].done = true;
    });

    expect(todos.state.items[0].done).toBe(true);

    // Oops, undo that
    todos.undo();
    expect(todos.state.items[0].done).toBe(false);

    // Actually complete it
    todos.redo();
    expect(todos.state.items[0].done).toBe(true);

    // Remove completed
    todos.update((state) => {
      state.items = state.items.filter((item) => !item.done);
    });

    expect(todos.state.items.length).toBe(2);

    // Wait for persist
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check persisted
    const persisted = localStorage.getItem('todo-app');
    expect(persisted).toBeTruthy();

    const parsed = JSON.parse(persisted!);
    expect(parsed.items.length).toBe(2);
  });

  it('should handle form with autosave and undo', async () => {
    interface FormState {
      name: string;
      email: string;
      message: string;
    }

    const form = createReactor<FormState>(
      {
        name: '',
        email: '',
        message: '',
      },
      {
        plugins: [
          persist({ key: 'contact-form', debounce: 500 }),
          undoRedo({ limit: 20 }),
        ],
      }
    );

    // User types name
    form.update((state) => {
      state.name = 'John';
    });

    // User types email
    form.update((state) => {
      state.email = 'john@example.com';
    });

    // User types message
    form.update((state) => {
      state.message = 'Hello!';
    });

    expect(form.state.name).toBe('John');
    expect(form.state.email).toBe('john@example.com');
    expect(form.state.message).toBe('Hello!');

    // User made a mistake, undo last change
    form.undo();
    expect(form.state.message).toBe('');

    // Type correct message
    form.update((state) => {
      state.message = 'Hello, this is a test message.';
    });

    // Wait for debounced persist
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Check persisted
    const persisted = localStorage.getItem('contact-form');
    expect(persisted).toBeTruthy();
  });
});
