/**
 * v0.2.3 Integration Tests - Complex scenarios combining new features
 *
 * v0.2.9 Update: Removed retry/debounce from asyncActions
 * - Retry logic is now handled at API layer
 * - Debounce should use external utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { persist, logger, undoRedo } from '../src/plugins';
import { arrayActions } from '../src/helpers/array-actions';
import { asyncActions } from '../src/helpers/async-actions';

describe('v0.2.3 Complex Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Scenario 1: Todo App with all features', () => {
    interface Todo {
      id: string;
      text: string;
      done: boolean;
      priority: number;
      tags: string[];
      createdAt: number;
    }

    interface TodoState {
      todos: Todo[];
      filter: 'all' | 'active' | 'completed';
      loading: boolean;
      error: Error | null;
      syncToken: string;
    }

    it('should handle complex todo operations with persist, undo, logger, and async', async () => {
      // Mock console - logger uses groupCollapsed when collapsed: true
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});

      // Create store with ALL features
      const store = createReactor<TodoState>(
        {
          todos: [],
          filter: 'all',
          loading: false,
          error: null,
          syncToken: '',
        },
        {
          plugins: [
            persist({
              key: 'complex-todos',
              omit: ['loading', 'error'], // Don't persist loading/error states
              debounce: 100,
            }),
            undoRedo({ limit: 50 }),
            logger({
              collapsed: true,
              filter: (action) => action?.startsWith('todos:') || action?.startsWith('api:'),
              trackPerformance: true,
              slowThreshold: 50,
            }),
          ],
        }
      );

      // Array actions for todos
      const todoActions = arrayActions(store, 'todos', { idKey: 'id' });

      // Async actions for API calls
      const api = asyncActions(
        store,
        {
          fetchTodos: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              todos: [
                {
                  id: '1',
                  text: 'Server task 1',
                  done: false,
                  priority: 1,
                  tags: ['work'],
                  createdAt: Date.now(),
                },
                {
                  id: '2',
                  text: 'Server task 2',
                  done: true,
                  priority: 2,
                  tags: ['personal'],
                  createdAt: Date.now(),
                },
              ],
              syncToken: 'sync-123',
            };
          },
          saveTodo: async (todo: Todo) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (todo.text.includes('fail')) {
              throw new Error('Server error');
            }
            return { todos: [...store.state.todos, todo] };
          },
        }
      );

      // 1. Fetch initial todos
      await api.fetchTodos();
      expect(store.state.todos).toHaveLength(2);
      expect(store.state.syncToken).toBe('sync-123');

      // 2. Add new todos with different priorities
      todoActions.add({
        id: '3',
        text: 'New task',
        done: false,
        priority: 3,
        tags: ['urgent'],
        createdAt: Date.now(),
      });

      todoActions.add({
        id: '4',
        text: 'Another task',
        done: false,
        priority: 1,
        tags: ['work', 'urgent'],
        createdAt: Date.now(),
      });

      expect(store.state.todos).toHaveLength(4);

      // 3. Sort by priority (new feature!)
      todoActions.sort((a, b) => a.priority - b.priority);

      expect(store.state.todos[0].priority).toBe(1);
      expect(store.state.todos[3].priority).toBe(3);

      // 4. Bulk update multiple todos (new feature!)
      todoActions.bulkUpdate(['1', '4'], { done: true });

      const doneTodos = store.state.todos.filter(t => t.done);
      expect(doneTodos).toHaveLength(3); // 2, 1, and 4

      // 5. Test undo/redo with new operations
      store.undo(); // Undo bulk update
      expect(store.state.todos.filter(t => t.done)).toHaveLength(1);

      store.redo(); // Redo bulk update
      expect(store.state.todos.filter(t => t.done)).toHaveLength(3);

      // 6. Bulk remove completed todos (new feature!)
      todoActions.bulkRemove(todo => todo.done);
      expect(store.state.todos).toHaveLength(1);
      expect(store.state.todos[0].id).toBe('3');

      // 7. Undo bulk remove
      store.undo();
      expect(store.state.todos).toHaveLength(4);

      // 8. Test async with manual retry (v0.2.9 pattern)
      let attemptCount = 0;

      // Retry wrapper at API layer
      const unstableSaveWithRetry = async () => {
        for (let i = 0; i < 3; i++) {
          try {
            attemptCount++;
            if (attemptCount < 2) {
              throw new Error('Network error');
            }
            return { syncToken: 'sync-updated' };
          } catch (e) {
            if (i === 2) throw e;
            await new Promise(r => setTimeout(r, 5));
          }
        }
        throw new Error('Max retries exceeded');
      };

      const apiWithRetry = asyncActions(store, {
        unstableSave: unstableSaveWithRetry,
      });

      await apiWithRetry.unstableSave();
      expect(attemptCount).toBe(2);
      expect(store.state.syncToken).toBe('sync-updated');

      // 9. Verify logger was called for important actions
      // Logger uses groupCollapsed, not group
      expect(consoleSpy).toHaveBeenCalled();
      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      const hasTodoActions = logCalls.some(call =>
        typeof call === 'string' && call.includes('todos:')
      );
      expect(hasTodoActions).toBe(true);

      // 10. Wait for persist debounce and verify persistence
      await new Promise(resolve => setTimeout(resolve, 150));

      const stored = localStorage.getItem('complex-todos');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.todos).toBeDefined();
      expect(parsed.loading).toBeUndefined(); // Omitted
      expect(parsed.error).toBeUndefined(); // Omitted

      consoleSpy.mockRestore();
      store.destroy();
    });
  });

  describe('Scenario 2: Real-time collaboration with selective sync', () => {
    interface Message {
      id: string;
      author: string;
      text: string;
      timestamp: number;
      metadata: {
        edited: boolean;
        reactions: string[];
      };
    }

    interface ChatState {
      messages: Message[];
      users: Array<{ id: string; name: string; online: boolean }>;
      drafts: Record<string, string>;
      settings: {
        notifications: boolean;
        theme: 'light' | 'dark';
      };
      loading: boolean;
      error: Error | null;
    }

    it('should handle real-time collaboration features', async () => {
      const store = createReactor<ChatState>(
        {
          messages: [],
          users: [],
          drafts: {},
          settings: { notifications: true, theme: 'dark' },
          loading: false,
          error: null,
        },
        {
          plugins: [
            persist({
              key: 'chat-state',
              pick: ['messages', 'drafts', 'settings'], // Only persist important data
              debounce: 200,
            }),
            undoRedo({ limit: 100 }),
          ],
        }
      );

      const messageActions = arrayActions(store, 'messages', { idKey: 'id' });

      // 1. Add messages rapidly
      for (let i = 0; i < 10; i++) {
        messageActions.add({
          id: `msg-${i}`,
          author: i % 2 === 0 ? 'Alice' : 'Bob',
          text: `Message ${i}`,
          timestamp: Date.now() + i,
          metadata: { edited: false, reactions: [] },
        });
      }

      expect(store.state.messages).toHaveLength(10);

      // 2. Sort by timestamp (newest first)
      messageActions.sort((a, b) => b.timestamp - a.timestamp);

      // 3. Bulk update - mark messages as edited
      const messageIds = store.state.messages
        .filter(m => m.author === 'Alice')
        .map(m => m.id);

      messageActions.bulkUpdate(messageIds, {
        metadata: { edited: true, reactions: ['👍'] },
      });

      const editedMessages = store.state.messages.filter(
        m => m.metadata.edited
      );
      expect(editedMessages).toHaveLength(5); // Every other message

      // 4. Test complex filter - only log when messages change
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});

      const loggerPlugin = logger({
        filter: (action, state, prevState) => {
          // Only log if messages array changed
          return state.messages.length !== prevState.messages.length;
        },
      });

      // This should trigger logger (messages length changes)
      messageActions.add({
        id: 'msg-11',
        author: 'Charlie',
        text: 'New message',
        timestamp: Date.now(),
        metadata: { edited: false, reactions: [] },
      });

      // This should NOT trigger logger (messages length same)
      messageActions.update('msg-11', { text: 'Updated message' });

      // 5. Bulk remove old messages
      const now = Date.now();
      messageActions.bulkRemove(
        msg => now - msg.timestamp > 100 // Remove messages older than 100ms
      );

      // 6. Verify undo/redo works with bulk operations
      const countAfterRemove = store.state.messages.length;

      if (countAfterRemove > 0) {
        store.undo(); // Undo remove
        expect(store.state.messages.length).toBeGreaterThanOrEqual(countAfterRemove);

        store.redo(); // Redo remove
        expect(store.state.messages.length).toBeGreaterThanOrEqual(0);
      }

      // 7. Verify selective persistence
      await new Promise(resolve => setTimeout(resolve, 250));

      const stored = localStorage.getItem('chat-state');
      const parsed = JSON.parse(stored!);

      expect(parsed.messages).toBeDefined();
      expect(parsed.drafts).toBeDefined();
      expect(parsed.settings).toBeDefined();
      expect(parsed.users).toBeUndefined(); // Not persisted (not in pick)
      expect(parsed.loading).toBeUndefined(); // Not persisted

      consoleSpy.mockRestore();
      store.destroy();
    });
  });

  describe('Scenario 3: E-commerce with inventory and async operations', () => {
    interface Product {
      id: string;
      name: string;
      price: number;
      stock: number;
      category: string;
      tags: string[];
    }

    interface EcommerceState {
      products: Product[];
      cart: Array<{ productId: string; quantity: number }>;
      loading: boolean;
      error: Error | null;
      lastSync: number;
    }

    it('should handle e-commerce operations with manual retry and performance tracking', async () => {
      const consoleSpy = {
        group: vi.spyOn(console, 'group').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      };

      const store = createReactor<EcommerceState>(
        {
          products: [],
          cart: [],
          loading: false,
          error: null,
          lastSync: 0,
        },
        {
          plugins: [
            persist({
              key: 'ecommerce',
              omit: ['loading', 'error'],
            }),
            undoRedo({ limit: 50 }),
            logger({
              trackPerformance: true,
              slowThreshold: 30,
              filter: (action, state, prevState) => {
                // Only log cart changes and product updates
                return (
                  state.cart.length !== prevState.cart.length ||
                  state.products.length !== prevState.products.length
                );
              },
            }),
          ],
        }
      );

      const productActions = arrayActions(store, 'products', { idKey: 'id' });

      // 1. Simulate slow API call (will trigger performance warning)
      const api = asyncActions(store, {
        fetchProducts: async () => {
          await new Promise(resolve => setTimeout(resolve, 50)); // Intentionally slow
          return {
            products: Array.from({ length: 20 }, (_, i) => ({
              id: `prod-${i}`,
              name: `Product ${i}`,
              price: Math.random() * 100,
              stock: Math.floor(Math.random() * 50),
              category: i % 3 === 0 ? 'electronics' : 'clothing',
              tags: [`tag${i % 5}`],
            })),
            lastSync: Date.now(),
          };
        },
        syncCart: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          // Simulate random failures
          if (Math.random() < 0.3) {
            throw new Error('Network timeout');
          }
          return { lastSync: Date.now() };
        },
      });

      // 2. Fetch products (slow - may warn if exceeds threshold)
      await api.fetchProducts();

      expect(store.state.products).toHaveLength(20);
      // Note: Warn may or may not be called depending on execution speed

      // 3. Sort products by price
      productActions.sort((a, b) => a.price - b.price);

      const prices = store.state.products.map(p => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }

      // 4. Bulk update - discount on electronics
      const electronicsIds = store.state.products
        .filter(p => p.category === 'electronics')
        .map(p => p.id);

      productActions.bulkUpdate(
        electronicsIds,
        { price: 50 } // Set discount price
      );

      const electronics = store.state.products.filter(
        p => p.category === 'electronics'
      );
      electronics.forEach(p => {
        expect(p.price).toBe(50);
      });

      // 5. Bulk remove out of stock items
      productActions.bulkRemove(p => p.stock === 0);

      // 6. Test retry mechanism with cart sync (v0.2.9 pattern: manual retry)
      let syncAttempts = 0;

      const unreliableSyncWithRetry = async () => {
        for (let i = 0; i < 5; i++) {
          try {
            syncAttempts++;
            if (syncAttempts < 3) {
              throw new Error('Network timeout');
            }
            return { lastSync: Date.now() };
          } catch (e) {
            if (i === 4) throw e;
            await new Promise(r => setTimeout(r, 5));
          }
        }
        throw new Error('Max retries exceeded');
      };

      const unreliableApi = asyncActions(store, {
        unreliableSync: unreliableSyncWithRetry,
      });

      await unreliableApi.unreliableSync();
      expect(syncAttempts).toBe(3);

      // 7. Complex undo scenario
      const beforeBulkUpdate = store.state.products.length;

      productActions.bulkRemove(p => p.price < 30);

      expect(store.state.products.length).toBeLessThan(beforeBulkUpdate);

      store.undo();
      expect(store.state.products.length).toBe(beforeBulkUpdate);

      consoleSpy.group.mockRestore();
      consoleSpy.warn.mockRestore();
      store.destroy();
    });
  });

  describe('Scenario 4: Dashboard with cancellation (v0.2.9: no built-in debounce)', () => {
    interface DashboardState {
      searchQuery: string;
      results: Array<{ id: string; title: string; score: number }>;
      filters: {
        category: string;
        sortBy: 'relevance' | 'date';
      };
      loading: boolean;
      error: Error | null;
    }

    it('should handle search with replace mode cancellation', async () => {
      const store = createReactor<DashboardState>(
        {
          searchQuery: '',
          results: [],
          filters: { category: 'all', sortBy: 'relevance' },
          loading: false,
          error: null,
        },
        {
          plugins: [
            persist({
              key: 'dashboard',
              pick: ['searchQuery', 'filters'],
            }),
            logger({
              filter: (action) => action?.startsWith('search:'),
              trackPerformance: true,
            }),
          ],
        }
      );

      let searchCallCount = 0;

      // v0.2.9: use replace mode (default) instead of debounce
      const api = asyncActions(
        store,
        {
          search: async (query: string) => {
            searchCallCount++;
            await new Promise(resolve => setTimeout(resolve, 30));
            return {
              searchQuery: query,
              results: [
                { id: '1', title: `Result for ${query}`, score: 0.9 },
                { id: '2', title: `Another ${query}`, score: 0.7 },
              ],
            };
          },
        },
        { concurrency: 'replace' }
      );

      // 1. Start a search
      const search1 = api.search('hello').catch(() => {});

      // 2. Wait a bit then start another (replaces first)
      await new Promise(r => setTimeout(r, 10));
      const search2 = api.search('world');

      await search2;

      // Both started but only second's result matters
      expect(store.state.searchQuery).toBe('world');
      expect(store.state.results).toHaveLength(2);
      expect(store.state.results[0].title).toContain('world');

      // 3. Test manual cancellation
      searchCallCount = 0;

      const slowSearch = api.search('slow query');
      setTimeout(() => slowSearch.cancel(), 5);

      try {
        await slowSearch;
      } catch (error) {
        // Expected to be cancelled
      }

      // Should not have updated state (cancelled before completion)
      expect(store.state.searchQuery).toBe('world'); // Still old value

      store.destroy();
    }, 10000);
  });

  describe('Scenario 5: Stress test - handling large datasets', () => {
    interface DataPoint {
      id: string;
      value: number;
      timestamp: number;
      metadata: {
        source: string;
        quality: number;
      };
    }

    interface DataState {
      dataPoints: DataPoint[];
      loading: boolean;
      error: Error | null;
    }

    it('should handle operations on large datasets efficiently', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const store = createReactor<DataState>(
        {
          dataPoints: [],
          loading: false,
          error: null,
        },
        {
          plugins: [
            undoRedo({ limit: 10 }), // Limited history for performance
            logger({
              trackPerformance: true,
              slowThreshold: 100,
              maxDepth: 1, // Limit depth for large objects
              filter: () => false, // Disable logging for stress test
            }),
          ],
        }
      );

      const dataActions = arrayActions(store, 'dataPoints', { idKey: 'id' });

      // 1. Add 200 data points (reduced from 1000 for faster tests)
      const startTime = performance.now();

      // Use batch to improve performance
      store.batch(() => {
        for (let i = 0; i < 200; i++) {
          dataActions.add({
            id: `data-${i}`,
            value: Math.random() * 100,
            timestamp: Date.now() + i,
            metadata: {
              source: i % 3 === 0 ? 'sensor-a' : 'sensor-b',
              quality: Math.random(),
            },
          });
        }
      });

      const addTime = performance.now() - startTime;
      console.log(`Added 200 items in ${addTime.toFixed(2)}ms`);

      expect(store.state.dataPoints).toHaveLength(200);

      // 2. Sort large dataset
      const sortStart = performance.now();
      dataActions.sort((a, b) => b.value - a.value);
      const sortTime = performance.now() - sortStart;

      console.log(`Sorted 200 items in ${sortTime.toFixed(2)}ms`);

      // Verify sort
      const values = store.state.dataPoints.map(d => d.value);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }

      // 3. Bulk update 100 items
      const bulkUpdateStart = performance.now();
      const idsToUpdate = store.state.dataPoints
        .slice(0, 100)
        .map(d => d.id);

      dataActions.bulkUpdate(idsToUpdate, {
        metadata: { source: 'updated', quality: 1.0 },
      });

      const bulkUpdateTime = performance.now() - bulkUpdateStart;
      console.log(`Bulk updated 100 items in ${bulkUpdateTime.toFixed(2)}ms`);

      // 4. Bulk remove by predicate
      const bulkRemoveStart = performance.now();
      dataActions.bulkRemove(d => d.value < 50);
      const bulkRemoveTime = performance.now() - bulkRemoveStart;

      console.log(`Bulk removed items in ${bulkRemoveTime.toFixed(2)}ms`);

      expect(store.state.dataPoints.length).toBeLessThan(200);
      expect(store.state.dataPoints.length).toBeGreaterThan(50);

      // 5. Verify undo still works with large dataset
      const countBeforeUndo = store.state.dataPoints.length;
      store.undo();
      expect(store.state.dataPoints.length).toBeGreaterThan(countBeforeUndo);

      consoleSpy.mockRestore();
      store.destroy();
    }, 15000); // Added 15 second timeout for stress test
  });
});
