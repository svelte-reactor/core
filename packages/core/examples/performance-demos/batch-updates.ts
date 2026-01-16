/**
 * Performance Demo: Batch Updates
 *
 * Shows the performance difference between individual updates
 * and batched updates for bulk operations.
 */

import { createReactor } from '../../src/core/reactor.svelte.js';

export function demoBatchUpdates() {
  console.log('=== Batch Updates Performance Demo ===\n');

  const store = createReactor<{ items: number[] }>({ items: [] });

  // ❌ Bad: Individual updates (slow)
  console.log('❌ Individual Updates:');
  const start1 = performance.now();
  for (let i = 0; i < 1000; i++) {
    store.update((s) => {
      s.items.push(i);
    });
  }
  const duration1 = performance.now() - start1;
  console.log(`  1000 individual updates: ${duration1.toFixed(2)}ms`);
  console.log(`  Average: ${(duration1 / 1000).toFixed(3)}ms per update`);

  // Reset
  store.update((s) => {
    s.items = [];
  });

  // ✅ Good: Batched update (fast)
  console.log('\n✅ Batched Update:');
  const start2 = performance.now();
  store.update((s) => {
    for (let i = 0; i < 1000; i++) {
      s.items.push(i);
    }
  });
  const duration2 = performance.now() - start2;
  console.log(`  1 batched update (1000 items): ${duration2.toFixed(2)}ms`);

  // Performance comparison
  const improvement = ((duration1 - duration2) / duration1) * 100;
  console.log(`\n📊 Performance Improvement: ${improvement.toFixed(1)}%`);
  console.log(`   ${(duration1 / duration2).toFixed(1)}x faster!\n`);
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoBatchUpdates();
}
