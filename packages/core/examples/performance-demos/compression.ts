/**
 * Performance Demo: Compression
 *
 * Shows storage size reduction with LZ compression.
 */

import { createReactor } from '../../src/core/reactor.svelte.js';
import { persist } from '../../src/plugins/persist-plugin.js';
import { memoryStorage } from '../../src/storage/memory-storage.js';

export function demoCompression() {
  console.log('=== Compression Demo ===\n');

  // Create data with repetitive patterns (compresses well)
  const repetitiveData = {
    users: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: 'user',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
    })),
  };

  // ❌ Without compression
  console.log('❌ Without Compression:');
  const store1 = createReactor(repetitiveData, {
    plugins: [
      persist({
        key: 'data-uncompressed',
        storage: 'memory',
        compress: false,
      }),
    ],
  });

  const uncompressed = memoryStorage.getItem('data-uncompressed');
  const uncompressedSize = uncompressed ? uncompressed.length : 0;

  console.log(`  Storage size: ${(uncompressedSize / 1024).toFixed(2)} KB`);
  console.log(`  100 user objects with repetitive data`);

  // ✅ With compression
  console.log('\n✅ With Compression:');
  memoryStorage.clear();

  const store2 = createReactor(repetitiveData, {
    plugins: [
      persist({
        key: 'data-compressed',
        storage: 'memory',
        compress: true, // Enable LZ compression
      }),
    ],
  });

  const compressed = memoryStorage.getItem('data-compressed');
  const compressedSize = compressed ? compressed.length : 0;

  console.log(`  Storage size: ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`  Same 100 user objects, compressed`);

  // Performance comparison
  const reduction = ((uncompressedSize - compressedSize) / uncompressedSize) * 100;
  const ratio = uncompressedSize / compressedSize;

  console.log(`\n📊 Compression Results:`);
  console.log(`   Size reduction: ${reduction.toFixed(1)}%`);
  console.log(`   Compression ratio: ${ratio.toFixed(2)}:1`);
  console.log(`   Saved: ${((uncompressedSize - compressedSize) / 1024).toFixed(2)} KB`);

  // Benefits
  console.log(`\n✅ Benefits:`);
  console.log(`   • Fits more data in 5MB localStorage limit`);
  console.log(`   • Faster save/load (less I/O)`);
  console.log(`   • Zero bundle size impact (tree-shakeable)`);
  console.log(`   • Backward compatible (auto-fallback)`);

  // Load performance
  console.log(`\n⚡ Load Performance:`);

  const loadStart1 = performance.now();
  const store3 = createReactor(
    { users: [] },
    {
      plugins: [
        persist({
          key: 'data-uncompressed',
          storage: 'memory',
          compress: false,
        }),
      ],
    }
  );
  const loadDuration1 = performance.now() - loadStart1;

  memoryStorage.clear();
  memoryStorage.setItem('data-compressed', compressed || '');

  const loadStart2 = performance.now();
  const store4 = createReactor(
    { users: [] },
    {
      plugins: [
        persist({
          key: 'data-compressed',
          storage: 'memory',
          compress: true,
        }),
      ],
    }
  );
  const loadDuration2 = performance.now() - loadStart2;

  console.log(`   Uncompressed load: ${loadDuration1.toFixed(2)}ms`);
  console.log(`   Compressed load: ${loadDuration2.toFixed(2)}ms`);

  // Cleanup
  store1.destroy();
  store2.destroy();
  store3.destroy();
  store4.destroy();
  memoryStorage.clear();

  console.log('');
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoCompression();
}
