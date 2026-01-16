/**
 * Tests for v0.2.7 new features
 * - reactor.select() method
 * - ReactorError class
 * - asyncActions concurrency option
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { ReactorError } from '../src/core/reactor-error.js';
import { asyncActions } from '../src/helpers/async-actions.js';
import { isEqual } from '../src/utils/clone.js';

describe('v0.2.7 Features', () => {
  describe('reactor.select() method', () => {
    it('should provide a simpler API for selective subscriptions', () => {
      const store = createReactor({ user: { name: 'John', age: 30 }, count: 0 });
      const callback = vi.fn();

      // Use the new select() method
      store.select(
        state => state.user.name,
        callback
      );

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('John', undefined);

      callback.mockClear();

      // Update count - should NOT fire
      store.update(s => { s.count++; });
      expect(callback).not.toHaveBeenCalled();

      // Update name - SHOULD fire
      store.update(s => { s.user.name = 'Jane'; });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('Jane', 'John');
    });

    it('should support fireImmediately: false option', () => {
      const store = createReactor({ count: 0 });
      const callback = vi.fn();

      store.select(
        state => state.count,
        callback,
        { fireImmediately: false }
      );

      // Should NOT fire initially
      expect(callback).not.toHaveBeenCalled();

      // Update - SHOULD fire now
      store.update(s => { s.count++; });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support custom equality function', () => {
      const store = createReactor({ items: [1, 2, 3] });
      const callback = vi.fn();

      store.select(
        state => state.items,
        callback,
        { equalityFn: isEqual }
      );

      callback.mockClear();

      // Update with same values - should NOT fire (deep equal)
      store.update(s => { s.items = [1, 2, 3]; });
      expect(callback).not.toHaveBeenCalled();

      // Update with different values - SHOULD fire
      store.update(s => { s.items = [1, 2, 3, 4]; });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const store = createReactor({ count: 0 });
      const callback = vi.fn();

      const unsubscribe = store.select(
        state => state.count,
        callback
      );

      callback.mockClear();

      // Update - should fire
      store.update(s => { s.count++; });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Update - should NOT fire
      store.update(s => { s.count++; });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('ReactorError class', () => {
    it('should create error with context', () => {
      const error = new ReactorError('Update failed', {
        reactor: 'counter',
        action: 'increment',
        plugin: 'persist',
        tip: 'Check your state initialization.'
      });

      expect(error.message).toBe('Update failed');
      expect(error.name).toBe('ReactorError');
      expect(error.context.reactor).toBe('counter');
      expect(error.context.action).toBe('increment');
      expect(error.context.plugin).toBe('persist');
      expect(error.context.tip).toBe('Check your state initialization.');
    });

    it('should format error message with toString()', () => {
      const error = new ReactorError('Update failed', {
        reactor: 'counter',
        action: 'increment',
        tip: 'Check your state initialization.'
      });

      const formatted = error.toString();
      expect(formatted).toContain('[Reactor:counter]');
      expect(formatted).toContain('Update failed');
      expect(formatted).toContain('Action: increment');
      expect(formatted).toContain('Tip: Check your state initialization.');
    });

    it('should create error with static helpers', () => {
      const destroyed = ReactorError.destroyed('myReactor');
      expect(destroyed.message).toBe('Cannot operate on destroyed reactor');
      expect(destroyed.context.reactor).toBe('myReactor');
      expect(destroyed.context.tip).toContain('Create a new reactor');

      const invalidState = ReactorError.invalidState('Missing field', 'myStore', { bad: 'state' });
      expect(invalidState.message).toBe('Missing field');
      expect(invalidState.context.state).toEqual({ bad: 'state' });

      const pluginError = ReactorError.pluginError('persist', 'Failed to save');
      expect(pluginError.message).toContain('persist');
      expect(pluginError.message).toContain('Failed to save');
    });

    it('should create error with tip using withTip()', () => {
      const error = ReactorError.withTip(
        'Invalid state',
        'Initialize state with default values',
        { reactor: 'test' }
      );

      expect(error.context.tip).toBe('Initialize state with default values');
      expect(error.context.reactor).toBe('test');
    });
  });

  describe('asyncActions concurrency option', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should support replace concurrency mode (default for debounced)', async () => {
      const store = createReactor({
        result: null as number | null,
        loading: false,
        error: null
      });

      let resolvers: ((value: number) => void)[] = [];

      const api = asyncActions(store, {
        fetch: async (id: number) => {
          return new Promise<{ result: number }>((resolve) => {
            resolvers.push((val) => resolve({ result: val }));
          });
        }
      }, {
        concurrency: 'replace'
      });

      // Start first request
      const p1 = api.fetch(1);

      // Start second request (should replace first)
      const p2 = api.fetch(2);

      // Resolve second request first
      resolvers[1](2);
      await vi.runAllTimersAsync();

      // Second request should update state
      expect(store.state.result).toBe(2);

      // Resolve first request
      resolvers[0](1);
      await vi.runAllTimersAsync();

      // First request (stale) should be ignored
      expect(store.state.result).toBe(2);
    });

    it('should handle loading state correctly with parallel concurrency', async () => {
      const store = createReactor({
        results: [] as number[],
        loading: false,
        error: null
      });

      let resolveCount = 0;
      const resolvers: (() => void)[] = [];

      const api = asyncActions(store, {
        fetch: async (id: number) => {
          return new Promise<{ results: number[] }>((resolve) => {
            resolvers.push(() => {
              resolveCount++;
              resolve({ results: [...store.state.results, id] });
            });
          });
        }
      }, {
        concurrency: 'parallel'
      });

      // Start three parallel requests
      api.fetch(1);
      api.fetch(2);
      api.fetch(3);

      // All should be loading
      expect(store.state.loading).toBe(true);

      // Resolve first
      resolvers[0]();
      await vi.runAllTimersAsync();

      // Still loading (other requests pending)
      // Note: With parallel, loading stays true until all complete
      expect(store.state.loading).toBe(true);

      // Resolve remaining
      resolvers[1]();
      resolvers[2]();
      await vi.runAllTimersAsync();

      // Now loading should be false
      expect(store.state.loading).toBe(false);
      expect(resolveCount).toBe(3);
    });
  });

  describe('DevTools memoization', () => {
    it('should cache getHistory() calls', () => {
      const store = createReactor({ count: 0 });

      // Make some updates to create history
      store.update(s => { s.count = 1; });
      store.update(s => { s.count = 2; });

      // Multiple getHistory() calls should be efficient
      // (We can't directly test memoization, but we can verify it works)
      const history1 = store.getHistory();
      const history2 = store.getHistory();

      // Both should return the same data
      expect(history1).toEqual(history2);
    });
  });
});
