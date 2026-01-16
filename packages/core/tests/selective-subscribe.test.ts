/**
 * Tests for selective subscription (select() method)
 *
 * NOTE: subscribe(options) overload was removed in v0.2.9.
 * Use select() for selective subscriptions instead.
 */

import { describe, it, expect, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { isEqual } from '../src/utils/clone.js';

describe('Selective Subscriptions', () => {
  describe('select() method', () => {
    it('should only fire when selected value changes', () => {
      const store = createReactor({ user: { name: 'John', age: 30 }, count: 0 });
      const callback = vi.fn();

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

      // Update age - should NOT fire (different field)
      store.update(s => { s.user.age = 31; });
      expect(callback).not.toHaveBeenCalled();

      // Update name - SHOULD fire
      store.update(s => { s.user.name = 'Jane'; });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('Jane', 'John');
    });

    it('should support nested paths', () => {
      const store = createReactor({
        data: {
          user: {
            profile: {
              name: 'John'
            }
          }
        },
        other: 'value'
      });
      const callback = vi.fn();

      store.select(
        state => state.data.user.profile.name,
        callback
      );

      callback.mockClear();

      // Update other field - should NOT fire
      store.update(s => { s.other = 'changed'; });
      expect(callback).not.toHaveBeenCalled();

      // Update nested name - SHOULD fire
      store.update(s => { s.data.user.profile.name = 'Jane'; });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('Jane', 'John');
    });

    it('should support fireImmediately: false', () => {
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
      // prevValue is 0 (initial value) since we initialized on first subscribe call
      expect(callback).toHaveBeenCalledWith(1, 0);
    });

    it('should support custom equality function', () => {
      const store = createReactor({ items: [1, 2, 3] });
      const callback = vi.fn();

      // Use deep equality check
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

    it('should support objects as selected values', () => {
      const store = createReactor({
        user: { name: 'John', age: 30 },
        count: 0
      });
      const callback = vi.fn();

      store.select(
        state => state.user,
        callback
      );

      callback.mockClear();

      // Update count - should fire (user object reference changed)
      store.update(s => { s.count++; });
      // Note: This WILL fire because the entire state object changed,
      // causing user reference to change (even though user content is same)
      expect(callback).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
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

    it('should work with primitive values', () => {
      const store = createReactor({ count: 0, name: 'John' });
      const callback = vi.fn();

      store.select(
        state => state.count,
        callback
      );

      callback.mockClear();

      // Multiple updates
      store.update(s => { s.count = 1; });
      store.update(s => { s.count = 2; });
      store.update(s => { s.count = 2; }); // Same value - should NOT fire

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 1, 0);
      expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
    });

    it('should handle undefined/null values', () => {
      const store = createReactor<{ value: string | null }>({ value: 'test' });
      const callback = vi.fn();

      store.select(
        state => state.value,
        callback
      );

      callback.mockClear();

      // Set to null
      store.update(s => { s.value = null; });
      expect(callback).toHaveBeenCalledWith(null, 'test');

      // Set back to string
      store.update(s => { s.value = 'test2'; });
      expect(callback).toHaveBeenCalledWith('test2', null);
    });
  });

  describe('multiple selective subscriptions', () => {
    it('should subscribe to multiple selectors independently', () => {
      const store = createReactor({
        user: { name: 'John', age: 30 },
        count: 0
      });
      const nameCallback = vi.fn();
      const countCallback = vi.fn();

      // Subscribe to each field independently
      store.select(state => state.user.name, nameCallback);
      store.select(state => state.count, countCallback);

      // Initial calls
      expect(nameCallback).toHaveBeenCalledTimes(1);
      expect(nameCallback).toHaveBeenCalledWith('John', undefined);
      expect(countCallback).toHaveBeenCalledTimes(1);
      expect(countCallback).toHaveBeenCalledWith(0, undefined);

      nameCallback.mockClear();
      countCallback.mockClear();

      // Update name - only name callback should fire
      store.update(s => { s.user.name = 'Jane'; });
      expect(nameCallback).toHaveBeenCalledTimes(1);
      expect(nameCallback).toHaveBeenCalledWith('Jane', 'John');
      expect(countCallback).not.toHaveBeenCalled();

      nameCallback.mockClear();
      countCallback.mockClear();

      // Update count - only count callback should fire
      store.update(s => { s.count++; });
      expect(countCallback).toHaveBeenCalledTimes(1);
      expect(countCallback).toHaveBeenCalledWith(1, 0);
      expect(nameCallback).not.toHaveBeenCalled();
    });

    it('should not fire when unselected fields change', () => {
      const store = createReactor({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' }
      });
      const nameCallback = vi.fn();
      const themeCallback = vi.fn();

      store.select(state => state.user.name, nameCallback);
      store.select(state => state.settings.theme, themeCallback);

      nameCallback.mockClear();
      themeCallback.mockClear();

      // Update age (not selected) - should NOT fire either callback
      store.update(s => { s.user.age = 31; });
      expect(nameCallback).not.toHaveBeenCalled();
      expect(themeCallback).not.toHaveBeenCalled();

      // Update name (selected) - SHOULD fire name callback only
      store.update(s => { s.user.name = 'Jane'; });
      expect(nameCallback).toHaveBeenCalledTimes(1);
      expect(themeCallback).not.toHaveBeenCalled();
    });
  });

  describe('Real-world scenarios', () => {
    it('should optimize form field subscriptions', () => {
      const store = createReactor({
        form: {
          name: '',
          email: '',
          age: 0
        },
        metadata: {
          lastSaved: Date.now()
        }
      });

      const nameCallback = vi.fn();
      const emailCallback = vi.fn();

      // Subscribe to individual fields
      store.select(s => s.form.name, nameCallback);
      store.select(s => s.form.email, emailCallback);

      nameCallback.mockClear();
      emailCallback.mockClear();

      // Update email - only email callback should fire
      store.update(s => { s.form.email = 'test@example.com'; });
      expect(nameCallback).not.toHaveBeenCalled();
      expect(emailCallback).toHaveBeenCalledTimes(1);

      // Update metadata - neither callback should fire
      store.update(s => { s.metadata.lastSaved = Date.now(); });
      expect(nameCallback).not.toHaveBeenCalled();
      expect(emailCallback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should optimize component subscriptions', () => {
      const store = createReactor({
        currentUser: { id: 1, name: 'John' },
        users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
        settings: { theme: 'dark' }
      });

      const callback = vi.fn();

      // Component only cares about currentUser and theme
      store.select(s => s.currentUser, callback);

      callback.mockClear();

      // Update users list - WILL fire because currentUser object reference changes
      // (smartClone creates new references even if content is same)
      store.update(s => { s.users.push({ id: 3, name: 'Bob' }); });
      // Note: This fires because even though user content is same,
      // the entire state is cloned, causing all nested references to change
      expect(callback).toHaveBeenCalledTimes(1);

      // Update settings - WILL also fire because it causes new object references
      store.update(s => { s.settings.theme = 'light'; });
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation', () => {
    it('should throw on invalid selector', () => {
      const store = createReactor({ count: 0 });

      expect(() => {
        store.select('not a function' as any, vi.fn());
      }).toThrow(TypeError);
    });

    it('should throw on invalid callback', () => {
      const store = createReactor({ count: 0 });

      expect(() => {
        store.select(s => s.count, 'not a function' as any);
      }).toThrow(TypeError);
    });
  });
});
