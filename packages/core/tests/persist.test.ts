/**
 * Persist integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { persist } from '../src/plugins';

interface CounterState {
  value: number;
}

describe('Persist plugin integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist reactor state to localStorage', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [persist({ key: 'test-counter' })],
    });

    counter.update((state) => {
      state.value = 42;
    });

    // Check localStorage
    const stored = localStorage.getItem('test-counter');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.value).toBe(42);
  });

  it('should load persisted state on initialization', () => {
    // First reactor - save state
    const counter1 = createReactor({ value: 0 }, {
      plugins: [persist({ key: 'test-counter-load' })],
    });

    counter1.update((state) => {
      state.value = 99;
    });

    counter1.destroy();

    // Second reactor - should load saved state
    const counter2 = createReactor({ value: 0 }, {
      plugins: [persist({ key: 'test-counter-load' })],
    });

    expect(counter2.state.value).toBe(99);
  });

  it('should work with debounce option', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({
          key: 'test-counter-debounce',
          debounce: 100,
        }),
      ],
    });

    counter.update((state) => {
      state.value = 1;
    });
    counter.update((state) => {
      state.value = 2;
    });
    counter.update((state) => {
      state.value = 3;
    });

    // State should be updated immediately in reactor
    expect(counter.state.value).toBe(3);

    // But localStorage might be debounced
    // (actual debounce test would need timers)
  });

  it('should support different storage types', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({
          key: 'test-counter-session',
          storage: 'sessionStorage',
        }),
      ],
    });

    counter.update((state) => {
      state.value = 123;
    });

    // Check sessionStorage
    const stored = sessionStorage.getItem('test-counter-session');
    expect(stored).toBeTruthy();
  });

  it('should sync state when storage changes externally', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({
          key: 'test-counter-sync',
          storage: 'localStorage',
        }),
      ],
    });

    // Initial value
    expect(counter.state.value).toBe(0);

    // Simulate external storage change (e.g., from another tab or DevTools)
    const newData = { value: 999 };
    localStorage.setItem('test-counter-sync', JSON.stringify(newData));

    // Trigger storage event manually (browser does this automatically for other tabs)
    const storageEvent = new StorageEvent('storage', {
      key: 'test-counter-sync',
      newValue: JSON.stringify(newData),
      oldValue: JSON.stringify({ value: 0 }),
      storageArea: localStorage,
      url: window.location.href,
    });

    window.dispatchEvent(storageEvent);

    // State should be synced
    expect(counter.state.value).toBe(999);

    counter.destroy();
  });

  it('should sync sessionStorage when changed externally', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({
          key: 'test-session-sync',
          storage: 'sessionStorage',
        }),
      ],
    });

    // Initial value
    expect(counter.state.value).toBe(0);

    // Simulate external sessionStorage change (e.g., from DevTools)
    const newData = { value: 777 };
    sessionStorage.setItem('test-session-sync', JSON.stringify(newData));

    // Trigger storage event
    const storageEvent = new StorageEvent('storage', {
      key: 'test-session-sync',
      newValue: JSON.stringify(newData),
      oldValue: JSON.stringify({ value: 0 }),
      storageArea: sessionStorage,
      url: window.location.href,
    });

    window.dispatchEvent(storageEvent);

    // State should be synced
    expect(counter.state.value).toBe(777);

    counter.destroy();
  });

  it('should work with compression option', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({
          key: 'test-counter-compress',
          compress: true,
        }),
      ],
    });

    counter.update((state) => {
      state.value = 456;
    });

    expect(counter.state.value).toBe(456);

    // State should be persisted (compressed or not)
    const stored = localStorage.getItem('test-counter-compress');
    expect(stored).toBeTruthy();
  });

  it('should support migrations', () => {
    // Save old version
    const oldData = {
      oldField: 'old-value',
      __version: 1,
    };
    localStorage.setItem('test-counter-migrate', JSON.stringify(oldData));

    // Create reactor with migration
    const counter = createReactor({ newField: 'default' }, {
      plugins: [
        persist({
          key: 'test-counter-migrate',
          version: 2,
          migrations: {
            2: (data: any) => ({
              newField: data.oldField || 'default',
            }),
          },
        }),
      ],
    });

    // Should have migrated data
    expect(counter.state.newField).toBe('old-value');
  });
});

describe('Persist with other plugins', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should work together with undoRedo plugin', async () => {
    const { undoRedo } = await import('../src/plugins');

    const counter = createReactor({ value: 0 }, {
      plugins: [
        persist({ key: 'test-persist-undo' }),
        undoRedo({ limit: 10 }),
      ],
    });

    counter.update((state) => {
      state.value = 5;
    });
    counter.update((state) => {
      state.value = 10;
    });

    // Should persist
    expect(counter.state.value).toBe(10);

    // Should undo
    counter.undo();
    expect(counter.state.value).toBe(5);

    // Undone state should also persist
    const stored = localStorage.getItem('test-persist-undo');
    expect(stored).toBeTruthy();
  });
});

describe('Persist with pick/omit (selective persistence)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should only persist picked fields', () => {
    interface AppState {
      user: { name: string; token: string };
      settings: { theme: string };
      temp: { cache: string[] };
    }

    const store = createReactor<AppState>({
      user: { name: 'John', token: 'secret123' },
      settings: { theme: 'dark' },
      temp: { cache: ['a', 'b'] },
    }, {
      plugins: [
        persist({
          key: 'test-pick',
          pick: ['user.name', 'settings'],
        }),
      ],
    });

    // Update state
    store.update((state) => {
      state.user.name = 'Jane';
      state.user.token = 'new-secret';
      state.settings.theme = 'light';
      state.temp.cache.push('c');
    });

    // Check what was persisted
    const stored = localStorage.getItem('test-pick');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);

    // Should have picked fields
    expect(parsed.user.name).toBe('Jane');
    expect(parsed.settings.theme).toBe('light');

    // Should NOT have other fields
    expect(parsed.user.token).toBeUndefined();
    expect(parsed.temp).toBeUndefined();

    store.destroy();
  });

  it('should omit specified fields from persistence', () => {
    interface AppState {
      user: { name: string; token: string };
      settings: { theme: string };
      temp: { cache: string[] };
    }

    const store = createReactor<AppState>({
      user: { name: 'John', token: 'secret123' },
      settings: { theme: 'dark' },
      temp: { cache: ['a', 'b'] },
    }, {
      plugins: [
        persist({
          key: 'test-omit',
          omit: ['user.token', 'temp'],
        }),
      ],
    });

    // Update state
    store.update((state) => {
      state.user.name = 'Jane';
      state.user.token = 'new-secret';
      state.settings.theme = 'light';
    });

    // Check what was persisted
    const stored = localStorage.getItem('test-omit');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);

    // Should have non-omitted fields
    expect(parsed.user.name).toBe('Jane');
    expect(parsed.settings.theme).toBe('light');

    // Should NOT have omitted fields
    expect(parsed.user.token).toBeUndefined();
    expect(parsed.temp).toBeUndefined();

    store.destroy();
  });

  it('should load state correctly with pick option', () => {
    interface AppState {
      count: number;
      settings: { theme: string };
    }

    // First reactor - save with pick
    const store1 = createReactor<AppState>({
      count: 0,
      settings: { theme: 'dark' },
    }, {
      plugins: [
        persist({
          key: 'test-pick-load',
          pick: ['count', 'settings'],
        }),
      ],
    });

    store1.update((state) => {
      state.count = 99;
      state.settings.theme = 'light';
    });

    store1.destroy();

    // Second reactor - should load only picked fields
    const store2 = createReactor<AppState>({
      count: 0,
      settings: { theme: 'default' },
    }, {
      plugins: [
        persist({
          key: 'test-pick-load',
          pick: ['count', 'settings'],
        }),
      ],
    });

    // Should load picked fields
    expect(store2.state.count).toBe(99);
    expect(store2.state.settings.theme).toBe('light');

    store2.destroy();
  });

  it('should work with debounce and pick', async () => {
    interface AppState {
      count: number;
      sensitive: string;
    }

    const store = createReactor<AppState>({
      count: 0,
      sensitive: 'secret',
    }, {
      plugins: [
        persist({
          key: 'test-debounce-pick',
          pick: ['count'],
          debounce: 50,
        }),
      ],
    });

    store.update((state) => {
      state.count = 1;
      state.sensitive = 'new-secret';
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 100));

    const stored = localStorage.getItem('test-debounce-pick');
    const parsed = JSON.parse(stored!);

    expect(parsed.count).toBe(1);
    expect(parsed.sensitive).toBeUndefined();

    store.destroy();
  });

  it('should handle nested paths in pick', () => {
    interface AppState {
      deep: {
        nested: {
          value: number;
          other: string;
        };
        shallow: string;
      };
      root: string;
    }

    const store = createReactor<AppState>({
      deep: {
        nested: { value: 42, other: 'test' },
        shallow: 'shallow',
      },
      root: 'root',
    }, {
      plugins: [
        persist({
          key: 'test-nested-pick',
          pick: ['deep.nested.value', 'root'],
        }),
      ],
    });

    store.update((state) => {
      state.deep.nested.value = 99;
      state.deep.nested.other = 'changed';
      state.root = 'changed-root';
    });

    const stored = localStorage.getItem('test-nested-pick');
    const parsed = JSON.parse(stored!);

    expect(parsed.deep.nested.value).toBe(99);
    expect(parsed.root).toBe('changed-root');
    expect(parsed.deep.nested.other).toBeUndefined();
    expect(parsed.deep.shallow).toBeUndefined();

    store.destroy();
  });

  it('should handle empty pick array', () => {
    const store = createReactor({ value: 42 }, {
      plugins: [
        persist({
          key: 'test-empty-pick',
          pick: [],
        }),
      ],
    });

    store.update((state) => {
      state.value = 99;
    });

    const stored = localStorage.getItem('test-empty-pick');
    const parsed = JSON.parse(stored!);

    // Empty pick should result in almost empty object (except internal fields)
    expect(parsed.value).toBeUndefined();

    store.destroy();
  });

  it('should not use both pick and omit together', () => {
    const store = createReactor({
      a: 1,
      b: 2,
      c: 3,
    }, {
      plugins: [
        persist({
          key: 'test-pick-and-omit',
          pick: ['a', 'b'],
          omit: ['c'], // This should be ignored when pick is present
        }),
      ],
    });

    store.update((state) => {
      state.a = 10;
      state.b = 20;
      state.c = 30;
    });

    const stored = localStorage.getItem('test-pick-and-omit');
    const parsed = JSON.parse(stored!);

    // Pick takes precedence
    expect(parsed.a).toBe(10);
    expect(parsed.b).toBe(20);
    expect(parsed.c).toBeUndefined();

    store.destroy();
  });
});
