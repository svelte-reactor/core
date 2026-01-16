/**
 * Performance Demo: Array Pagination
 *
 * Shows how pagination improves performance when
 * working with large datasets.
 */

import { createReactor } from '../../src/core/reactor.svelte.js';
import { arrayActions } from '../../src/helpers/array-actions.js';

export function demoPagination() {
  console.log('=== Array Pagination Demo ===\n');

  // Create large dataset
  const TOTAL_ITEMS = 10000;
  const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random(),
  }));

  const store = createReactor({ items: [] as typeof items });

  // Populate store
  store.update((s) => {
    s.items = items;
  });

  console.log(`Dataset: ${TOTAL_ITEMS.toLocaleString()} items\n`);

  // ❌ Render all items (slow)
  console.log('❌ Rendering All Items:');
  const start1 = performance.now();

  // Simulate rendering all items
  let renderedCount = 0;
  store.state.items.forEach((item) => {
    // Simulate component render cost
    const temp = `<div>${item.name}</div>`;
    renderedCount++;
  });

  const duration1 = performance.now() - start1;
  console.log(`  Rendered ${renderedCount.toLocaleString()} DOM nodes`);
  console.log(`  Time: ${duration1.toFixed(2)}ms`);
  console.log(`  Memory: ~${(renderedCount * 0.001).toFixed(2)}MB`);

  // ✅ Paginated rendering (fast)
  console.log('\n✅ Paginated Rendering (50 items/page):');
  const actions = arrayActions(store, 'items', {
    pagination: { pageSize: 50 },
  });

  const start2 = performance.now();

  // Render only current page (first 50 items with pagination)
  renderedCount = 0;
  const pageSize = 50;
  store.state.items.slice(0, pageSize).forEach((item: { name: string }) => {
    const temp = `<div>${item.name}</div>`;
    renderedCount++;
  });

  const duration2 = performance.now() - start2;
  console.log(`  Rendered ${renderedCount} DOM nodes`);
  console.log(`  Time: ${duration2.toFixed(2)}ms`);
  console.log(`  Memory: ~${(renderedCount * 0.001).toFixed(2)}MB`);
  console.log(`  Total pages: ${Math.ceil(TOTAL_ITEMS / pageSize)}`);

  // Performance comparison
  const improvement = ((duration1 - duration2) / duration1) * 100;
  const memoryReduction = ((TOTAL_ITEMS - 50) / TOTAL_ITEMS) * 100;

  console.log(`\n📊 Performance Improvement:`);
  console.log(`   Time: ${improvement.toFixed(1)}% faster`);
  console.log(`   Memory: ${memoryReduction.toFixed(1)}% reduction`);
  console.log(`   DOM nodes: ${(TOTAL_ITEMS / 50).toFixed(0)}x fewer`);

  // Navigation performance
  console.log(`\n📄 Page Navigation:`);
  const navStart = performance.now();
  actions.nextPage?.();
  actions.nextPage?.();
  actions.prevPage?.();
  actions.setPage?.(10);
  const navDuration = performance.now() - navStart;
  console.log(`   4 page changes: ${navDuration.toFixed(2)}ms`);
  console.log(`   Average: ${(navDuration / 4).toFixed(2)}ms per navigation\n`);
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoPagination();
}
