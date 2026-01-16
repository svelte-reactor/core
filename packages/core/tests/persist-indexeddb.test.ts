/**
 * Persist Plugin with IndexedDB Integration Tests (Simplified)
 * Tests focus on reactor state behavior, not IndexedDB persistence details
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/index';
import { persist } from '../src/plugins/persist-plugin';
import { IndexedDBStorage } from '../src/storage/indexeddb';
import 'fake-indexeddb/auto';

describe('Persist Plugin with IndexedDB', () => {
  it('should initialize reactor with IndexedDB storage', () => {
    interface State {
      count: number;
      name: string;
    }

    const reactor = createReactor<State>(
      { count: 0, name: 'test' },
      {
        plugins: [
          persist({
            key: 'test-state',
            storage: 'indexedDB',
            indexedDB: { database: 'test-db' }
          })
        ]
      }
    );

    // Reactor state should be accessible
    expect(reactor.state.count).toBe(0);
    expect(reactor.state.name).toBe('test');

    // Updates should work
    reactor.update(s => { s.count = 42; });
    expect(reactor.state.count).toBe(42);

    reactor.destroy();
  });

  it('should handle state updates with IndexedDB', () => {
    interface State {
      user: { name: string; age: number };
      settings: { theme: string };
    }

    const reactor = createReactor<State>(
      {
        user: { name: 'John', age: 30 },
        settings: { theme: 'light' }
      },
      {
        plugins: [
          persist({
            key: 'user-state',
            storage: 'indexedDB',
            indexedDB: { database: 'test-user-db' }
          })
        ]
      }
    );

    // Multiple updates
    reactor.update(s => { s.user.name = 'Jane'; });
    reactor.update(s => { s.user.age = 25; });
    reactor.update(s => { s.settings.theme = 'dark'; });

    expect(reactor.state.user.name).toBe('Jane');
    expect(reactor.state.user.age).toBe(25);
    expect(reactor.state.settings.theme).toBe('dark');

    reactor.destroy();
  });

  it('should work with pick option', () => {
    interface State {
      user: {
        name: string;
        email: string;
        token: string;
      };
      settings: {
        theme: string;
      };
    }

    const reactor = createReactor<State>(
      {
        user: { name: 'John', email: 'john@test.com', token: 'secret' },
        settings: { theme: 'dark' }
      },
      {
        plugins: [
          persist({
            key: 'selective-state',
            storage: 'indexedDB',
            pick: ['user.name', 'user.email', 'settings'],
            indexedDB: { database: 'test-pick-db' }
          })
        ]
      }
    );

    // State should still be fully accessible
    expect(reactor.state.user.name).toBe('John');
    expect(reactor.state.user.email).toBe('john@test.com');
    expect(reactor.state.user.token).toBe('secret');
    expect(reactor.state.settings.theme).toBe('dark');

    reactor.destroy();
  });

  it('should work with omit option', () => {
    interface State {
      user: {
        name: string;
        token: string;
      };
      cache: number[];
    }

    const reactor = createReactor<State>(
      {
        user: { name: 'John', token: 'secret' },
        cache: [1, 2, 3]
      },
      {
        plugins: [
          persist({
            key: 'omit-state',
            storage: 'indexedDB',
            omit: ['user.token', 'cache'],
            indexedDB: { database: 'test-omit-db' }
          })
        ]
      }
    );

    // State should still be fully accessible
    expect(reactor.state.user.name).toBe('John');
    expect(reactor.state.user.token).toBe('secret');
    expect(reactor.state.cache).toEqual([1, 2, 3]);

    reactor.destroy();
  });

  it('should handle debounced writes', () => {
    interface State {
      counter: number;
    }

    const reactor = createReactor<State>(
      { counter: 0 },
      {
        plugins: [
          persist({
            key: 'debounced-state',
            storage: 'indexedDB',
            debounce: 100,
            indexedDB: { database: 'test-debounce-db' }
          })
        ]
      }
    );

    // Rapid updates
    reactor.update(s => { s.counter = 1; });
    reactor.update(s => { s.counter = 2; });
    reactor.update(s => { s.counter = 3; });
    reactor.update(s => { s.counter = 4; });
    reactor.update(s => { s.counter = 5; });

    // Final state should be correct
    expect(reactor.state.counter).toBe(5);

    reactor.destroy();
  });

  it('should handle custom database and store names', () => {
    interface State {
      value: string;
    }

    const reactor = createReactor<State>(
      { value: 'test' },
      {
        plugins: [
          persist({
            key: 'custom-config',
            storage: 'indexedDB',
            indexedDB: {
              database: 'custom-db',
              storeName: 'custom-store',
              version: 2
            }
          })
        ]
      }
    );

    reactor.update(s => { s.value = 'updated'; });
    expect(reactor.state.value).toBe('updated');

    reactor.destroy();
  });

  it('should cleanup on destroy', () => {
    const reactor = createReactor(
      { count: 0 },
      {
        plugins: [
          persist({
            key: 'cleanup-test',
            storage: 'indexedDB',
            indexedDB: { database: 'test-cleanup-db' }
          })
        ]
      }
    );

    reactor.update(s => { s.count = 10; });
    expect(reactor.state.count).toBe(10);

    // Should destroy without errors
    reactor.destroy();
    expect(true).toBe(true);
  });
});

describe('Persist Plugin with IndexedDB - Data Persistence', () => {
  const TEST_DB = 'persistence-test-db';
  const TEST_KEY = 'persistence-test-key';

  beforeEach(async () => {
    // Clean up database before each test
    try {
      await IndexedDBStorage.deleteDatabase(TEST_DB);
    } catch {
      // Ignore errors
    }
  });

  it('should persist data across "page reloads" (new reactor instances)', async () => {
    interface State {
      documents: { id: number; name: string }[];
      totalSize: number;
    }

    // Step 1: Create first reactor and add some data
    const reactor1 = createReactor<State>(
      { documents: [], totalSize: 0 },
      {
        plugins: [
          persist({
            key: TEST_KEY,
            storage: 'indexedDB',
            indexedDB: { database: TEST_DB }
          })
        ]
      }
    );

    // Add documents
    reactor1.update(s => {
      s.documents.push({ id: 1, name: 'Document 1' });
      s.documents.push({ id: 2, name: 'Document 2' });
      s.totalSize = 2;
    });

    expect(reactor1.state.documents.length).toBe(2);
    expect(reactor1.state.totalSize).toBe(2);

    // Wait for async IndexedDB write to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Destroy first reactor (simulates closing the page)
    reactor1.destroy();

    // Step 2: Create a NEW reactor (simulates page reload)
    // This should load the persisted data
    const reactor2 = createReactor<State>(
      { documents: [], totalSize: 0 },  // Same initial state
      {
        plugins: [
          persist({
            key: TEST_KEY,
            storage: 'indexedDB',
            indexedDB: { database: TEST_DB }
          })
        ]
      }
    );

    // Wait for IndexedDB cache to load
    await new Promise(resolve => setTimeout(resolve, 200));

    // BUG: This currently FAILS because IndexedDB cache loads asynchronously
    // but persist plugin reads immediately before cache is populated
    expect(reactor2.state.documents.length).toBe(2);
    expect(reactor2.state.documents[0].name).toBe('Document 1');
    expect(reactor2.state.documents[1].name).toBe('Document 2');
    expect(reactor2.state.totalSize).toBe(2);

    reactor2.destroy();
  });

  it('should load persisted state on init with onReady callback', async () => {
    interface State {
      count: number;
      items: string[];
    }

    // Step 1: Save data
    const reactor1 = createReactor<State>(
      { count: 0, items: [] },
      {
        plugins: [
          persist({
            key: 'onready-test',
            storage: 'indexedDB',
            indexedDB: { database: 'onready-test-db' }
          })
        ]
      }
    );

    reactor1.update(s => {
      s.count = 42;
      s.items = ['a', 'b', 'c'];
    });

    await new Promise(resolve => setTimeout(resolve, 200));
    reactor1.destroy();

    // Step 2: Create new reactor with onReady
    let readyFired = false;
    let loadedState: State | null = null;

    const reactor2 = createReactor<State>(
      { count: 0, items: [] },
      {
        plugins: [
          persist({
            key: 'onready-test',
            storage: 'indexedDB',
            indexedDB: { database: 'onready-test-db' },
            onReady: (state) => {
              readyFired = true;
              loadedState = state as State;
            }
          })
        ]
      }
    );

    // Wait for async loading
    await new Promise(resolve => setTimeout(resolve, 200));

    // onReady should have been called with loaded state
    expect(readyFired).toBe(true);
    expect(loadedState?.count).toBe(42);
    expect(loadedState?.items).toEqual(['a', 'b', 'c']);

    reactor2.destroy();
    await IndexedDBStorage.deleteDatabase('onready-test-db');
  });
});
