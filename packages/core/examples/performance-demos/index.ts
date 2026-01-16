/**
 * Performance Demos - Run All
 *
 * Demonstrates various performance optimization techniques
 * for svelte-reactor applications.
 */

import { demoBatchUpdates } from './batch-updates.js';
import { demoDebounce } from './debounce-persistence.js';
import { demoPagination } from './array-pagination.js';
import { demoSelectivePersistence } from './selective-persistence.js';
import { demoCompression } from './compression.js';

async function runAllDemos() {
  console.log('\n🚀 SVELTE-REACTOR PERFORMANCE DEMOS\n');
  console.log('Demonstrating optimization techniques for production apps.\n');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    // 1. Batch Updates
    demoBatchUpdates();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 2. Debounced Persistence
    await demoDebounce();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Array Pagination
    demoPagination();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Selective Persistence
    demoSelectivePersistence();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 5. Compression
    demoCompression();

    console.log('='.repeat(60));
    console.log('\n✅ All demos completed!');
    console.log('\nFor more info, see: PERFORMANCE_GUIDE.md\n');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run all demos
runAllDemos();
