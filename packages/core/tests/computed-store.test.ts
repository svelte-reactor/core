/**
 * Tests for computedStore() helper
 */

import { describe, it, expect, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { computedStore } from '../src/helpers/computed-store.js';
import { isEqual } from '../src/utils/clone.js';
import { get } from 'svelte/store';

describe('computedStore', () => {
  describe('Basic functionality', () => {
    it('should compute initial value', () => {
      const store = createReactor({ count: 5 });
      const doubled = computedStore(store, state => state.count * 2);

      expect(get(doubled)).toBe(10);
    });

    it('should update when state changes', () => {
      const store = createReactor({ count: 5 });
      const doubled = computedStore(store, state => state.count * 2);

      expect(get(doubled)).toBe(10);

      store.update(s => { s.count = 10; });
      expect(get(doubled)).toBe(20);
    });

    it('should work with complex computations', () => {
      const store = createReactor({
        items: [
          { id: 1, done: false },
          { id: 2, done: true },
          { id: 3, done: false }
        ]
      });

      const completedCount = computedStore(
        store,
        state => state.items.filter(item => item.done).length
      );

      expect(get(completedCount)).toBe(1);

      store.update(s => { s.items[0].done = true; });
      expect(get(completedCount)).toBe(2);
    });
  });

  describe('Dependency tracking with keys', () => {
    it('should only recompute when specified keys change', () => {
      const computeFn = vi.fn((state: { items: any[], filter: string, count: number }) => {
        return state.items.filter(item => {
          if (state.filter === 'completed') return item.done;
          if (state.filter === 'active') return !item.done;
          return true;
        });
      });

      const store = createReactor({
        items: [
          { id: 1, done: false },
          { id: 2, done: true }
        ],
        filter: 'all',
        count: 0
      });

      const filtered = computedStore(store, computeFn, {
        keys: ['items', 'filter']
      });

      // Subscribe to track computations
      const callback = vi.fn();
      filtered.subscribe(callback);

      const initialCallCount = computeFn.mock.calls.length;
      callback.mockClear();

      // Update count - should NOT recompute
      store.update(s => { s.count++; });
      expect(computeFn).toHaveBeenCalledTimes(initialCallCount); // No new calls

      // Update filter - SHOULD recompute
      store.update(s => { s.filter = 'completed'; });
      expect(computeFn.mock.calls.length).toBeGreaterThan(initialCallCount);

      const afterFilterCallCount = computeFn.mock.calls.length;

      // Update items - SHOULD recompute
      store.update(s => { s.items.push({ id: 3, done: false }); });
      expect(computeFn.mock.calls.length).toBeGreaterThan(afterFilterCallCount);
    });

    it('should support nested key paths', () => {
      const computeFn = vi.fn((state: { user: { profile: { name: string } }, count: number }) => {
        return state.user.profile.name.toUpperCase();
      });

      const store = createReactor({
        user: {
          profile: {
            name: 'John'
          }
        },
        count: 0
      });

      const upperName = computedStore(store, computeFn, {
        keys: ['user.profile.name']
      });

      get(upperName);
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Update count - should NOT recompute
      store.update(s => { s.count++; });
      get(upperName);
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Update name - SHOULD recompute
      store.update(s => { s.user.profile.name = 'Jane'; });
      get(upperName);
      expect(computeFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Custom equality function', () => {
    it('should use custom equals to prevent updates', () => {
      const callback = vi.fn();

      const store = createReactor({
        items: [1, 2, 3]
      });

      const sorted = computedStore(
        store,
        state => [...state.items].sort(),
        {
          equals: isEqual  // Deep equality
        }
      );

      sorted.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);

      // Update with same content - should NOT trigger callback
      store.update(s => { s.items = [1, 2, 3]; });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1 (deep equal)

      // Update with different content - SHOULD trigger callback
      store.update(s => { s.items = [1, 2, 3, 4]; });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should prevent re-renders with stable references', () => {
      const callback = vi.fn();

      const store = createReactor({
        items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
        filter: 'all'
      });

      const filtered = computedStore(
        store,
        state => state.items.filter(() => true),
        {
          keys: ['items'],  // Only track items
          equals: isEqual  // Deep equality
        }
      );

      filtered.subscribe(callback);
      const initialCallCount = callback.mock.calls.length;

      // Update filter (not in keys) - should NOT trigger
      store.update(s => { s.filter = 'none'; });
      expect(callback).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('Combined keys and equals', () => {
    it('should combine dependency tracking with result equality', () => {
      const computeFn = vi.fn((state: { items: any[], filter: string, metadata: any }) => {
        return state.items.filter(item => {
          if (state.filter === 'completed') return item.done;
          if (state.filter === 'active') return !item.done;
          return true;
        });
      });

      const callback = vi.fn();

      const store = createReactor({
        items: [
          { id: 1, done: false },
          { id: 2, done: true }
        ],
        filter: 'all',
        metadata: { lastSaved: Date.now() }
      });

      const filtered = computedStore(store, computeFn, {
        keys: ['items', 'filter'],
        equals: isEqual
      });

      filtered.subscribe(callback);
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);

      // Update metadata - should NOT recompute (not in keys)
      const beforeMetadataUpdate = computeFn.mock.calls.length;
      store.update(s => { s.metadata.lastSaved = Date.now(); });
      expect(computeFn).toHaveBeenCalledTimes(beforeMetadataUpdate); // No new calls
      expect(callback.mock.calls.length).toBe(1); // Still initial call only

      // Update filter to same result - SHOULD recompute but NOT notify (same result)
      store.update(s => { s.filter = 'active'; });
      expect(computeFn).toHaveBeenCalledTimes(2);
      // Callback called because result changed ([{ id: 1 }] !== [{ id: 1 }, { id: 2 }])
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance optimization', () => {
    it('should cache results and prevent expensive recomputations', () => {
      const expensiveCompute = vi.fn((state: { items: number[], metadata: { updated: number } }) => {
        // Simulate expensive operation
        return state.items.reduce((sum, n) => sum + n, 0);
      });

      const store = createReactor({
        items: [1, 2, 3, 4, 5],
        metadata: { updated: 0 }
      });

      const sum = computedStore(store, expensiveCompute, {
        keys: ['items']
      });

      // Subscribe to trigger initial computation
      const callback = vi.fn();
      sum.subscribe(callback);

      const initialCallCount = expensiveCompute.mock.calls.length;

      // Update metadata (not in keys) - should NOT recompute
      store.update(s => { s.metadata.updated++; });
      expect(expensiveCompute).toHaveBeenCalledTimes(initialCallCount);

      // Update items - SHOULD recompute
      store.update(s => { s.items.push(6); });
      expect(expensiveCompute.mock.calls.length).toBeGreaterThan(initialCallCount);
      expect(get(sum)).toBe(21);
    });
  });

  describe('Real-world scenarios', () => {
    it('should optimize todo list filtering', () => {
      interface Todo {
        id: number;
        text: string;
        done: boolean;
      }

      const store = createReactor<{
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        search: string;
      }>({
        todos: [
          { id: 1, text: 'Buy milk', done: false },
          { id: 2, text: 'Walk dog', done: true },
          { id: 3, text: 'Write code', done: false }
        ],
        filter: 'all',
        search: ''
      });

      const filteredTodos = computedStore(
        store,
        state => {
          let result = state.todos;

          // Filter by status
          if (state.filter === 'active') {
            result = result.filter(t => !t.done);
          } else if (state.filter === 'completed') {
            result = result.filter(t => t.done);
          }

          // Filter by search
          if (state.search) {
            result = result.filter(t =>
              t.text.toLowerCase().includes(state.search.toLowerCase())
            );
          }

          return result;
        },
        {
          keys: ['todos', 'filter', 'search'],
          equals: isEqual
        }
      );

      // All todos
      expect(get(filteredTodos)).toHaveLength(3);

      // Filter to active
      store.update(s => { s.filter = 'active'; });
      expect(get(filteredTodos)).toHaveLength(2);

      // Search
      store.update(s => { s.search = 'milk'; });
      expect(get(filteredTodos)).toHaveLength(1);
      expect(get(filteredTodos)[0].text).toBe('Buy milk');
    });

    it('should optimize shopping cart totals', () => {
      interface CartItem {
        id: number;
        name: string;
        price: number;
        quantity: number;
      }

      const store = createReactor<{ items: CartItem[] }>({
        items: [
          { id: 1, name: 'Apple', price: 1.5, quantity: 3 },
          { id: 2, name: 'Bread', price: 2.0, quantity: 1 }
        ]
      });

      const total = computedStore(
        store,
        state => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        {
          keys: ['items']
        }
      );

      expect(get(total)).toBe(6.5);

      // Add item
      store.update(s => {
        s.items.push({ id: 3, name: 'Milk', price: 3.0, quantity: 2 });
      });
      expect(get(total)).toBe(12.5);

      // Update quantity
      store.update(s => { s.items[0].quantity = 5; });
      expect(get(total)).toBe(15.5);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined/null values', () => {
      const store = createReactor<{ value: string | null }>({ value: null });

      const computed = computedStore(store, state => state.value?.toUpperCase() ?? 'NULL');

      expect(get(computed)).toBe('NULL');

      store.update(s => { s.value = 'test'; });
      expect(get(computed)).toBe('TEST');

      store.update(s => { s.value = null; });
      expect(get(computed)).toBe('NULL');
    });

    it('should handle empty arrays', () => {
      const store = createReactor<{ items: number[] }>({ items: [] });

      const sum = computedStore(store, state => state.items.reduce((a, b) => a + b, 0));

      expect(get(sum)).toBe(0);

      store.update(s => { s.items = [1, 2, 3]; });
      expect(get(sum)).toBe(6);

      store.update(s => { s.items = []; });
      expect(get(sum)).toBe(0);
    });

    it('should handle subscriptions correctly', () => {
      const store = createReactor({ count: 0 });
      const doubled = computedStore(store, state => state.count * 2);

      const callback = vi.fn();
      const unsubscribe = doubled.subscribe(callback);

      expect(callback).toHaveBeenCalledWith(0);

      store.update(s => { s.count = 5; });
      expect(callback).toHaveBeenCalledWith(10);

      unsubscribe();

      store.update(s => { s.count = 10; });
      expect(callback).toHaveBeenCalledTimes(2); // Not called after unsubscribe
    });
  });
});
