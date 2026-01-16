/**
 * Derived store export tests
 * Testing that derived, get, readonly are properly exported and work with svelte-reactor stores
 */

import { describe, it, expect } from 'vitest';
import { simpleStore, derived, get, readonly } from '../src/index.js';
import { createReactor } from '../src/core/reactor.svelte.js';

describe('Derived store exports', () => {
  describe('derived export', () => {
    it('should be exported from svelte-reactor', () => {
      expect(derived).toBeDefined();
      expect(typeof derived).toBe('function');
    });

    it('should work with simpleStore', () => {
      const count = simpleStore(0);
      const doubled = derived(count, $count => $count * 2);

      let value: number | undefined;
      doubled.subscribe(v => value = v);

      expect(value).toBe(0);

      count.update(c => c + 5);
      expect(value).toBe(10);
    });

    it('should work with multiple simpleStores', () => {
      const firstName = simpleStore('John');
      const lastName = simpleStore('Doe');

      const fullName = derived(
        [firstName, lastName],
        ([$first, $last]) => `${$first} ${$last}`
      );

      let name: string | undefined;
      fullName.subscribe(v => name = v);

      expect(name).toBe('John Doe');

      firstName.set('Jane');
      expect(name).toBe('Jane Doe');

      lastName.set('Smith');
      expect(name).toBe('Jane Smith');
    });

    it('should work with createReactor stores', () => {
      interface CounterState {
        count: number;
        multiplier: number;
      }

      const counter = createReactor<CounterState>({ count: 0, multiplier: 2 });

      const result = derived(counter, $counter => $counter.count * $counter.multiplier);

      let value: number | undefined;
      result.subscribe(v => value = v);

      expect(value).toBe(0);

      counter.update(state => {
        state.count = 5;
      });
      expect(value).toBe(10);

      counter.update(state => {
        state.multiplier = 3;
      });
      expect(value).toBe(15);
    });

    it('should support initial value', () => {
      const count = simpleStore(0);
      const doubled = derived(count, $count => $count * 2, -1);

      let value: number | undefined;
      doubled.subscribe(v => value = v);

      // Initial value should be from derived, not computed
      expect(value).toBe(0); // Svelte derived computes immediately
    });

    it('should handle complex derivations', () => {
      interface TodoState {
        todos: Array<{ id: number; text: string; completed: boolean }>;
      }

      const todos = createReactor<TodoState>({
        todos: [
          { id: 1, text: 'Task 1', completed: false },
          { id: 2, text: 'Task 2', completed: true },
          { id: 3, text: 'Task 3', completed: false },
        ]
      });

      const completedCount = derived(
        todos,
        $todos => $todos.todos.filter(t => t.completed).length
      );

      const pendingCount = derived(
        todos,
        $todos => $todos.todos.filter(t => !t.completed).length
      );

      const summary = derived(
        [completedCount, pendingCount],
        ([$completed, $pending]) => ({
          completed: $completed,
          pending: $pending,
          total: $completed + $pending
        })
      );

      let summaryValue: any;
      summary.subscribe(v => summaryValue = v);

      expect(summaryValue).toEqual({
        completed: 1,
        pending: 2,
        total: 3
      });

      // Complete a task
      todos.update(state => {
        state.todos[0].completed = true;
      });

      expect(summaryValue).toEqual({
        completed: 2,
        pending: 1,
        total: 3
      });
    });
  });

  describe('get export', () => {
    it('should be exported from svelte-reactor', () => {
      expect(get).toBeDefined();
      expect(typeof get).toBe('function');
    });

    it('should get current value from simpleStore', () => {
      const count = simpleStore(42);
      expect(get(count)).toBe(42);

      count.set(100);
      expect(get(count)).toBe(100);
    });

    it('should get current value from createReactor', () => {
      const counter = createReactor({ value: 5 });
      expect(get(counter)).toEqual({ value: 5 });

      counter.update(state => {
        state.value = 10;
      });
      expect(get(counter)).toEqual({ value: 10 });
    });

    it('should get current value from derived store', () => {
      const count = simpleStore(10);
      const doubled = derived(count, $count => $count * 2);

      expect(get(doubled)).toBe(20);

      count.set(15);
      expect(get(doubled)).toBe(30);
    });

    it('should work with complex state', () => {
      interface UserState {
        name: string;
        age: number;
        settings: {
          theme: string;
          notifications: boolean;
        };
      }

      const user = createReactor<UserState>({
        name: 'John',
        age: 30,
        settings: {
          theme: 'dark',
          notifications: true
        }
      });

      const currentState = get(user);
      expect(currentState.name).toBe('John');
      expect(currentState.settings.theme).toBe('dark');
    });
  });

  describe('readonly export', () => {
    it('should be exported from svelte-reactor', () => {
      expect(readonly).toBeDefined();
      expect(typeof readonly).toBe('function');
    });

    it('should create readonly version of simpleStore', () => {
      const count = simpleStore(0);
      const readonlyCount = readonly(count);

      // Should not have set or update methods
      expect((readonlyCount as any).set).toBeUndefined();
      expect((readonlyCount as any).update).toBeUndefined();

      // Should still be subscribable
      let value: number | undefined;
      readonlyCount.subscribe(v => value = v);
      expect(value).toBe(0);

      // Original store changes should reflect
      count.set(42);
      expect(value).toBe(42);
      expect(get(readonlyCount)).toBe(42);
    });

    it('should create readonly version of createReactor', () => {
      const counter = createReactor({ count: 0 });
      const readonlyCounter = readonly(counter);

      // Should not have set or update methods
      expect((readonlyCounter as any).set).toBeUndefined();
      expect((readonlyCounter as any).update).toBeUndefined();

      let value: any;
      readonlyCounter.subscribe(v => value = v);
      expect(value).toEqual({ count: 0 });

      counter.update(state => {
        state.count = 5;
      });
      expect(value).toEqual({ count: 5 });
    });

    it('should work with derived stores', () => {
      const count = simpleStore(0);
      const doubled = derived(count, $count => $count * 2);
      const readonlyDoubled = readonly(doubled);

      let value: number | undefined;
      readonlyDoubled.subscribe(v => value = v);

      expect(value).toBe(0);

      count.set(10);
      expect(value).toBe(20);
    });
  });

  describe('Integration: Single import source', () => {
    it('should import all from svelte-reactor', () => {
      // This test verifies the main benefit - single import source
      const count = simpleStore(0);
      const doubled = derived(count, $count => $count * 2);

      expect(get(count)).toBe(0);
      expect(get(doubled)).toBe(0);

      count.set(5);
      expect(get(count)).toBe(5);
      expect(get(doubled)).toBe(10);

      const readonlyCount = readonly(count);
      expect(get(readonlyCount)).toBe(5);
    });

    it('should work in real-world scenario', () => {
      // Simulate a real shopping cart scenario
      interface CartItem {
        id: number;
        name: string;
        price: number;
        quantity: number;
      }

      interface CartState {
        items: CartItem[];
      }

      const cart = createReactor<CartState>({
        items: []
      });

      const totalItems = derived(
        cart,
        $cart => $cart.items.reduce((sum, item) => sum + item.quantity, 0)
      );

      const totalPrice = derived(
        cart,
        $cart => $cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      );

      const cartSummary = derived(
        [totalItems, totalPrice],
        ([$items, $price]) => ({
          itemCount: $items,
          total: $price,
          formatted: `${$items} items - $${$price.toFixed(2)}`
        })
      );

      // Initial state
      expect(get(totalItems)).toBe(0);
      expect(get(totalPrice)).toBe(0);

      // Add items
      cart.update(state => {
        state.items.push(
          { id: 1, name: 'Product A', price: 10, quantity: 2 },
          { id: 2, name: 'Product B', price: 15, quantity: 1 }
        );
      });

      expect(get(totalItems)).toBe(3);
      expect(get(totalPrice)).toBe(35);
      expect(get(cartSummary).formatted).toBe('3 items - $35.00');

      // Update quantity
      cart.update(state => {
        state.items[0].quantity = 5;
      });

      expect(get(totalItems)).toBe(6);
      expect(get(totalPrice)).toBe(65);
    });
  });
});
