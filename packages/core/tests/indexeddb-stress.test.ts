/**
 * IndexedDB Stress Tests
 * High-load tests combining multiple features to find edge cases and bugs
 */

import { describe, it, expect } from 'vitest';
import { createReactor, asyncActions } from '../src/index';
import { persist } from '../src/plugins/persist-plugin';
import { undoRedo } from '../src/plugins/undo-plugin';
import 'fake-indexeddb/auto';

describe('IndexedDB Stress Tests', () => {
  it('should handle rapid updates with IndexedDB + undo/redo', () => {
    interface State {
      count: number;
      items: number[];
    }

    const reactor = createReactor<State>(
      { count: 0, items: [] },
      {
        plugins: [
          persist({
            key: 'stress-undo-test',
            storage: 'indexedDB',
            debounce: 50,
            indexedDB: { database: 'stress-undo-db' }
          }),
          undoRedo({ limit: 100 })
        ]
      }
    );

    // Perform 100 rapid updates
    for (let i = 1; i <= 100; i++) {
      reactor.update(s => {
        s.count = i;
        s.items.push(i);
      }, `update-${i}`);
    }

    // Verify final state
    expect(reactor.state.count).toBe(100);
    expect(reactor.state.items.length).toBe(100);
    expect(reactor.state.items[99]).toBe(100);

    // Verify undo/redo works
    expect(reactor.canUndo()).toBe(true);

    // Undo 50 times
    for (let i = 0; i < 50; i++) {
      reactor.undo();
    }

    expect(reactor.state.count).toBe(50);
    expect(reactor.state.items.length).toBe(50);

    // Redo 25 times
    for (let i = 0; i < 25; i++) {
      reactor.redo();
    }

    expect(reactor.state.count).toBe(75);
    expect(reactor.state.items.length).toBe(75);

    reactor.destroy();
  });

  it('should handle IndexedDB + async actions with manual retries (v0.2.9)', async () => {
    interface State {
      data: string[];
      loading: boolean;
      error: Error | null;
    }

    const reactor = createReactor<State>(
      { data: [], loading: false, error: null },
      {
        plugins: [
          persist({
            key: 'stress-async-test',
            storage: 'indexedDB',
            indexedDB: { database: 'stress-async-db' }
          })
        ]
      }
    );

    let attemptCount = 0;
    const maxAttempts = 3;

    // v0.2.9: Manual retry at API layer
    const fetchDataWithRetry = async (id: number) => {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          attemptCount++;
          if (attemptCount < maxAttempts) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { data: [...reactor.state.data, `data-${id}`] };
        } catch (e) {
          if (i === maxAttempts - 1) throw e;
          await new Promise(r => setTimeout(r, 10));
        }
      }
      throw new Error('Max retries exceeded');
    };

    const api = asyncActions(reactor, {
      fetchData: fetchDataWithRetry,
    });

    await api.fetchData(1);

    // Should succeed after retries
    expect(reactor.state.loading).toBe(false);
    expect(reactor.state.error).toBe(null);
    expect(reactor.state.data).toEqual(['data-1']);
    expect(attemptCount).toBe(3);

    reactor.destroy();
  });

  it('should handle large dataset with pick/omit + IndexedDB', { timeout: 10000 }, () => {
    interface State {
      users: Array<{
        id: number;
        name: string;
        email: string;
        password: string;
        metadata: any;
      }>;
      cache: number[];
      settings: { theme: string };
    }

    // Create 1000 user records
    const users = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@test.com`,
      password: `secret${i}`,
      metadata: { created: Date.now(), active: i % 2 === 0 }
    }));

    const reactor = createReactor<State>(
      {
        users,
        cache: Array.from({ length: 500 }, (_, i) => i),
        settings: { theme: 'dark' }
      },
      {
        plugins: [
          persist({
            key: 'stress-large-data',
            storage: 'indexedDB',
            // Don't persist passwords and cache
            omit: ['users.*.password', 'cache'],
            indexedDB: { database: 'stress-large-db' }
          })
        ]
      }
    );

    // State should be accessible
    expect(reactor.state.users.length).toBe(1000);
    expect(reactor.state.users[500].name).toBe('User 500');
    expect(reactor.state.cache.length).toBe(500);

    // Update many records
    for (let i = 0; i < 100; i++) {
      reactor.update(s => {
        s.users[i].name = `Updated User ${i}`;
      });
    }

    // Verify updates
    expect(reactor.state.users[50].name).toBe('Updated User 50');

    reactor.destroy();
  });

  it('should handle concurrent operations with multiple reactors', () => {
    interface State {
      value: number;
      timestamp: number;
    }

    const dbName = 'stress-concurrent-db';

    // Create 5 reactors using same database
    const reactors = Array.from({ length: 5 }, (_, i) =>
      createReactor<State>(
        { value: 0, timestamp: 0 },
        {
          plugins: [
            persist({
              key: `reactor-${i}`,
              storage: 'indexedDB',
              indexedDB: { database: dbName }
            })
          ]
        }
      )
    );

    // Update all reactors concurrently
    reactors.forEach((reactor, i) => {
      for (let j = 0; j < 10; j++) {
        reactor.update(s => {
          s.value = i * 100 + j;
          s.timestamp = Date.now();
        });
      }
    });

    // Verify each reactor has correct state
    reactors.forEach((reactor, i) => {
      expect(reactor.state.value).toBe(i * 100 + 9);
    });

    // Cleanup
    reactors.forEach(r => r.destroy());
  });

  it('should handle batch operations with IndexedDB + undo/redo', () => {
    interface State {
      counters: { [key: string]: number };
    }

    const reactor = createReactor<State>(
      { counters: {} },
      {
        plugins: [
          persist({
            key: 'stress-batch-test',
            storage: 'indexedDB',
            debounce: 100,
            indexedDB: { database: 'stress-batch-db' }
          }),
          undoRedo({ limit: 50 })
        ]
      }
    );

    // Perform 10 batch operations, each creating 10 counters
    for (let batch = 0; batch < 10; batch++) {
      reactor.batch(() => {
        for (let i = 0; i < 10; i++) {
          reactor.update(s => {
            const key = `batch${batch}-counter${i}`;
            s.counters[key] = (s.counters[key] || 0) + 1;
          });
        }
      });
    }

    // Should have 100 counters
    const keys = Object.keys(reactor.state.counters);
    expect(keys.length).toBe(100);
    expect(reactor.state.counters['batch5-counter5']).toBe(1);

    // Each batch should be a single undo step
    const initialKeys = keys.length;
    reactor.undo();
    expect(Object.keys(reactor.state.counters).length).toBe(initialKeys - 10);

    reactor.undo();
    expect(Object.keys(reactor.state.counters).length).toBe(initialKeys - 20);

    reactor.destroy();
  });

  it('should handle rapid destroy/recreate cycles', () => {
    interface State {
      value: string;
    }

    const dbName = 'stress-destroy-db';
    const key = 'stress-destroy-key';

    // Create and destroy reactor 20 times
    for (let i = 0; i < 20; i++) {
      const reactor = createReactor<State>(
        { value: `iteration-${i}` },
        {
          plugins: [
            persist({
              key,
              storage: 'indexedDB',
              indexedDB: { database: dbName }
            })
          ]
        }
      );

      reactor.update(s => { s.value = `updated-${i}`; });
      expect(reactor.state.value).toBe(`updated-${i}`);

      reactor.destroy();
    }

    // Should not throw errors or leak memory
    expect(true).toBe(true);
  });

  it('should handle mixed sync and async operations', async () => {
    interface State {
      syncCounter: number;
      asyncData: string[];
      mixedValue: number;
      loading: boolean;
      error: Error | null;
    }

    const reactor = createReactor<State>(
      { syncCounter: 0, asyncData: [], mixedValue: 0, loading: false, error: null },
      {
        plugins: [
          persist({
            key: 'stress-mixed-test',
            storage: 'indexedDB',
            debounce: 50,
            indexedDB: { database: 'stress-mixed-db' }
          })
        ]
      }
    );

    // v0.2.9: Use queue mode to ensure all async operations complete in order
    const api = asyncActions(reactor, {
      asyncOp: async (value: string) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { asyncData: [...reactor.state.asyncData, value] };
      }
    }, { concurrency: 'queue' });

    // Mix sync and async operations
    const operations: Promise<any>[] = [];
    for (let i = 0; i < 50; i++) {
      // Sync update
      reactor.update(s => { s.syncCounter++; });

      // Async operation
      operations.push(api.asyncOp(`async-${i}`));

      // Another sync update
      reactor.update(s => { s.mixedValue = i; });
    }

    // Wait for all async operations
    await Promise.all(operations);

    // Verify all operations completed
    expect(reactor.state.syncCounter).toBe(50);
    expect(reactor.state.asyncData.length).toBe(50);
    expect(reactor.state.mixedValue).toBe(49);

    reactor.destroy();
  });

  it('should handle deep nested state with IndexedDB', () => {
    interface State {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: number;
                items: number[];
              };
            };
          };
        };
      };
    }

    const reactor = createReactor<State>(
      {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 0,
                  items: []
                }
              }
            }
          }
        }
      },
      {
        plugins: [
          persist({
            key: 'stress-deep-test',
            storage: 'indexedDB',
            pick: ['level1.level2.level3.level4.level5.value'],
            indexedDB: { database: 'stress-deep-db' }
          }),
          undoRedo({ limit: 100 })
        ]
      }
    );

    // Perform 100 deep updates
    for (let i = 1; i <= 100; i++) {
      reactor.update(s => {
        s.level1.level2.level3.level4.level5.value = i;
        s.level1.level2.level3.level4.level5.items.push(i);
      });
    }

    expect(reactor.state.level1.level2.level3.level4.level5.value).toBe(100);
    expect(reactor.state.level1.level2.level3.level4.level5.items.length).toBe(100);

    // Test undo/redo with deep state
    reactor.undo();
    expect(reactor.state.level1.level2.level3.level4.level5.value).toBe(99);

    reactor.redo();
    expect(reactor.state.level1.level2.level3.level4.level5.value).toBe(100);

    reactor.destroy();
  });

  it('should handle very rapid updates (performance test)', () => {
    interface State {
      counter: number;
      values: number[];
    }

    const reactor = createReactor<State>(
      { counter: 0, values: [] },
      {
        plugins: [
          persist({
            key: 'stress-perf-test',
            storage: 'indexedDB',
            debounce: 200, // High debounce for rapid updates
            indexedDB: { database: 'stress-perf-db' }
          }),
          undoRedo({ limit: 200 })
        ]
      }
    );

    const startTime = Date.now();

    // Perform 500 rapid updates
    for (let i = 0; i < 500; i++) {
      reactor.update(s => {
        s.counter++;
        s.values.push(i);
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (< 1 second)
    expect(duration).toBeLessThan(1000);

    // Verify state
    expect(reactor.state.counter).toBe(500);
    expect(reactor.state.values.length).toBe(500);

    reactor.destroy();
  });
});
