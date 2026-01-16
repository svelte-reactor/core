/**
 * Benchmark: Large Array Performance
 *
 * Measures performance of array operations with large datasets
 */

import { describe, bench } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { arrayActions } from '../src/helpers/array-actions.js';

describe('Large Array Performance', () => {
  // Small array baseline
  bench('Update small array (100 items)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.add({ id: 100, value: 100 });
  });

  // Medium array
  bench('Update medium array (1,000 items)', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.add({ id: 1000, value: 1000 });
  });

  // Large array (the problem case)
  bench('Update large array (10,000 items)', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.add({ id: 10000, value: 10000 });
  });

  // Very large array
  bench('Update very large array (50,000 items)', () => {
    const items = Array.from({ length: 50000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.add({ id: 50000, value: 50000 });
  });

  // Direct state update (bypass arrayActions)
  bench('Direct update large array (10,000 items)', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });

    store.update(s => {
      s.items.push({ id: 10000, value: 10000 });
    });
  });

  // Bulk operations
  bench('Bulk add 100 items to large array (10,000 items)', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });

    store.update(s => {
      for (let i = 0; i < 100; i++) {
        s.items.push({ id: 10000 + i, value: 10000 + i });
      }
    });
  });

  // Remove operation
  bench('Remove item from large array (10,000 items)', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.remove(5000);
  });

  // Update operation
  bench('Update item in large array (10,000 items)', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
    const store = createReactor({ items });
    const actions = arrayActions(store, 'items');

    actions.update(5000, { value: 999 });
  });
});

describe('Clone Performance Comparison', () => {
  const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i, value: i }));
  const state = { items: largeArray, count: 0 };

  // Current: Deep clone entire state
  bench('Current: structuredClone entire state', () => {
    structuredClone(state);
  });

  // Alternative: Shallow clone array
  bench('Alternative: Shallow clone array only', () => {
    const cloned = { ...state, items: [...state.items] };
  });

  // Alternative: No clone for unchanged fields
  bench('Alternative: Clone only changed fields', () => {
    const cloned = {
      items: [...state.items],
      count: state.count
    };
  });
});
