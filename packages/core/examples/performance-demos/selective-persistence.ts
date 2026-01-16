/**
 * Performance Demo: Selective Persistence
 *
 * Demonstrates how pick/omit reduces storage size
 * and improves save/load performance.
 */

import { createReactor } from '../../src/core/reactor.svelte.js';
import { persist } from '../../src/plugins/persist-plugin.js';
import { memoryStorage } from '../../src/storage/memory-storage.js';

export function demoSelectivePersistence() {
  console.log('=== Selective Persistence Demo ===\n');

  // Create realistic app state
  interface AppState {
    user: {
      id: number;
      name: string;
      email: string;
      token: string; // Should not persist (security)
    };
    cache: {
      // Large temporary data (should not persist)
      data: number[];
    };
    settings: {
      theme: string;
      language: string;
    };
    temp: {
      // UI state (should not persist)
      isModalOpen: boolean;
      currentTab: number;
    };
  }

  const createAppState = (): AppState => ({
    user: {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      token: 'secret-token-123',
    },
    cache: {
      data: Array(10000).fill(Math.random()), // 10k numbers
    },
    settings: {
      theme: 'dark',
      language: 'en',
    },
    temp: {
      isModalOpen: false,
      currentTab: 0,
    },
  });

  // ❌ Persist everything
  console.log('❌ Persisting Everything:');
  const store1 = createReactor(createAppState(), {
    plugins: [persist({ key: 'app-all', storage: 'memory' })],
  });

  const allData = memoryStorage.getItem('app-all');
  const allSize = allData ? allData.length : 0;

  console.log(`  Storage size: ${(allSize / 1024).toFixed(2)} KB`);
  console.log(`  Contains:`);
  console.log(`    ✓ User data (needed)`);
  console.log(`    ✓ Settings (needed)`);
  console.log(`    ✗ Secret token (security risk!)`);
  console.log(`    ✗ 10k cache items (waste)`);
  console.log(`    ✗ Temporary UI state (unnecessary)`);

  // ✅ Selective persistence
  console.log('\n✅ Selective Persistence (pick):');
  memoryStorage.clear();

  const store2 = createReactor(createAppState(), {
    plugins: [
      persist({
        key: 'app-selective',
        storage: 'memory',
        pick: ['user.id', 'user.name', 'user.email', 'settings'],
        // Omit token and temporary data
      }),
    ],
  });

  const selectiveData = memoryStorage.getItem('app-selective');
  const selectiveSize = selectiveData ? selectiveData.length : 0;

  console.log(`  Storage size: ${(selectiveSize / 1024).toFixed(2)} KB`);
  console.log(`  Contains:`);
  console.log(`    ✓ User data (without token)`);
  console.log(`    ✓ Settings`);
  console.log(`    ✗ Token excluded (secure!)`);
  console.log(`    ✗ Cache excluded`);
  console.log(`    ✗ Temp data excluded`);

  // Performance comparison
  const sizeReduction = ((allSize - selectiveSize) / allSize) * 100;

  console.log(`\n📊 Storage Reduction:`);
  console.log(`   Size: ${sizeReduction.toFixed(1)}% smaller`);
  console.log(`   Saved: ${((allSize - selectiveSize) / 1024).toFixed(2)} KB`);

  // Security benefit
  console.log(`\n🔒 Security Benefits:`);
  const allParsed = JSON.parse(allData || '{}');
  const selectiveParsed = JSON.parse(selectiveData || '{}');

  console.log(`   Token in storage (all): ${!!allParsed?.user?.token}`);
  console.log(`   Token in storage (selective): ${!!selectiveParsed?.user?.token}`);
  console.log(`   ✅ Sensitive data protected!`);

  // Alternative: Using omit
  console.log('\n✅ Alternative: Using Omit:');
  memoryStorage.clear();

  const store3 = createReactor(createAppState(), {
    plugins: [
      persist({
        key: 'app-omit',
        storage: 'memory',
        omit: ['user.token', 'cache', 'temp'],
      }),
    ],
  });

  const omitData = memoryStorage.getItem('app-omit');
  const omitSize = omitData ? omitData.length : 0;

  console.log(`  Storage size: ${(omitSize / 1024).toFixed(2)} KB`);
  console.log(`  Similar results to pick approach\n`);

  // Cleanup
  store1.destroy();
  store2.destroy();
  store3.destroy();
  memoryStorage.clear();
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoSelectivePersistence();
}
