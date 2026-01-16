/**
 * Tests for batch utilities
 *
 * NOTE: batch() and batchAll() were removed in v0.2.9.
 * Use reactor.batch() directly instead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { undoRedo } from '../src/plugins/undo-plugin.js';
import { batched, debouncedBatch } from '../src/utils/batch.js';

describe('Batch Utilities', () => {
  describe('reactor.batch() (direct usage)', () => {
    it('should batch multiple updates into single notification', () => {
      const store = createReactor({ count: 0, name: 'John' });
      const subscriber = vi.fn();

      store.subscribe(subscriber);
      subscriber.mockClear(); // Clear initial call

      store.batch(() => {
        store.update(s => { s.count++; });
        store.update(s => { s.name = 'Jane'; });
        store.update(s => { s.count++; });
      });

      // Should only notify once after batch completes
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(store.state).toEqual({ count: 2, name: 'Jane' });
    });

    it('should work with undo/redo history', () => {
      const store = createReactor(
        { count: 0, name: 'John' },
        { plugins: [undoRedo({ limit: 10 })] }
      );

      store.batch(() => {
        store.update(s => { s.count++; });
        store.update(s => { s.name = 'Jane'; });
        store.update(s => { s.count++; });
      });

      expect(store.state).toEqual({ count: 2, name: 'Jane' });

      // Batch creates single history entry
      store.undo();
      expect(store.state).toEqual({ count: 0, name: 'John' });

      store.redo();
      expect(store.state).toEqual({ count: 2, name: 'Jane' });
    });

    it('should handle errors gracefully', () => {
      const store = createReactor({ count: 0 });

      expect(() => {
        store.batch(() => {
          store.update(s => { s.count++; });
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // State should be updated up to the error
      expect(store.state.count).toBe(1);
    });
  });

  describe('batched()', () => {
    it('should create a batched version of a function', () => {
      const store = createReactor({ items: [] as string[] });
      const subscriber = vi.fn();

      store.subscribe(subscriber);
      subscriber.mockClear();

      const addMultiple = batched(store, (items: string[]) => {
        items.forEach(item => {
          store.update(s => { s.items.push(item); });
        });
      });

      addMultiple(['a', 'b', 'c']);

      // Only one notification despite 3 updates
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(store.state.items).toEqual(['a', 'b', 'c']);
    });

    it('should return the function result', () => {
      const store = createReactor({ count: 0 });

      const incrementAndGet = batched(store, () => {
        store.update(s => { s.count++; });
        return store.state.count;
      });

      const result = incrementAndGet();
      expect(result).toBe(1);
    });

    it('should pass arguments correctly', () => {
      const store = createReactor({ items: [] as number[] });

      const addRange = batched(store, (start: number, end: number) => {
        for (let i = start; i <= end; i++) {
          store.update(s => { s.items.push(i); });
        }
      });

      addRange(1, 3);
      expect(store.state.items).toEqual([1, 2, 3]);
    });

    it('should work with undo/redo', () => {
      const store = createReactor(
        { items: [] as string[] },
        { plugins: [undoRedo({ limit: 10 })] }
      );

      const addMultiple = batched(store, (items: string[]) => {
        items.forEach(item => {
          store.update(s => { s.items.push(item); });
        });
      });

      addMultiple(['a', 'b', 'c']);
      expect(store.state.items).toEqual(['a', 'b', 'c']);

      // Single undo for entire batch
      store.undo();
      expect(store.state.items).toEqual([]);
    });
  });

  describe('debouncedBatch()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should debounce multiple updates', () => {
      const store = createReactor({ count: 0 });
      const subscriber = vi.fn();

      store.subscribe(subscriber);
      subscriber.mockClear();

      const debouncedUpdate = debouncedBatch(store, 300);

      // Rapid updates
      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));

      // Nothing executed yet
      expect(store.state.count).toBe(0);
      expect(subscriber).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(300);

      // All updates batched together
      expect(store.state.count).toBe(3);
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on new update', () => {
      const store = createReactor({ count: 0 });
      const debouncedUpdate = debouncedBatch(store, 300);

      debouncedUpdate(() => store.update(s => { s.count++; }));
      vi.advanceTimersByTime(100);

      debouncedUpdate(() => store.update(s => { s.count++; })); // Resets timer
      vi.advanceTimersByTime(250); // Not enough time

      expect(store.state.count).toBe(0); // Not executed yet

      vi.advanceTimersByTime(50); // Now 300ms from last update

      expect(store.state.count).toBe(2); // Both updates executed
    });

    it('should handle multiple debounced batch calls', () => {
      const store = createReactor({ count: 0 });
      const debouncedUpdate = debouncedBatch(store, 200);

      // First batch
      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));
      vi.advanceTimersByTime(200);

      expect(store.state.count).toBe(2);

      // Second batch
      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));
      vi.advanceTimersByTime(200);

      expect(store.state.count).toBe(4);
    });

    it('should work with undo/redo', () => {
      const store = createReactor(
        { count: 0 },
        { plugins: [undoRedo({ limit: 10 })] }
      );

      const debouncedUpdate = debouncedBatch(store, 300);

      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));
      debouncedUpdate(() => store.update(s => { s.count++; }));

      vi.advanceTimersByTime(300);

      expect(store.state.count).toBe(3);

      // Single undo for entire debounced batch
      store.undo();
      expect(store.state.count).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle form updates efficiently', () => {
      const store = createReactor({
        name: '',
        email: '',
        age: 0,
        address: {
          street: '',
          city: ''
        }
      });

      const subscriber = vi.fn();
      store.subscribe(subscriber);
      subscriber.mockClear();

      const handleFormSubmit = batched(store, (formData: Record<string, any>) => {
        store.update(s => { s.name = formData.name; });
        store.update(s => { s.email = formData.email; });
        store.update(s => { s.age = formData.age; });
        store.update(s => { s.address.street = formData.street; });
        store.update(s => { s.address.city = formData.city; });
      });

      handleFormSubmit({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        street: '123 Main St',
        city: 'New York'
      });

      // Single notification for all form fields
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(store.state.name).toBe('John Doe');
      expect(store.state.email).toBe('john@example.com');
      expect(store.state.age).toBe(30);
    });

    it('should handle search input with debouncing', () => {
      vi.useFakeTimers();

      const store = createReactor({ query: '', results: [] as string[] });
      const subscriber = vi.fn();

      store.subscribe(subscriber);
      subscriber.mockClear();

      const updateSearch = debouncedBatch(store, 300);

      // Simulate rapid typing
      updateSearch(() => store.update(s => { s.query = 'r'; }));
      updateSearch(() => store.update(s => { s.query = 're'; }));
      updateSearch(() => store.update(s => { s.query = 'rea'; }));
      updateSearch(() => store.update(s => { s.query = 'reac'; }));
      updateSearch(() => store.update(s => { s.query = 'react'; }));

      // No updates yet
      expect(store.state.query).toBe('');
      expect(subscriber).not.toHaveBeenCalled();

      // Wait for debounce
      vi.advanceTimersByTime(300);

      // All updates batched
      expect(store.state.query).toBe('react');
      expect(subscriber).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });
});
