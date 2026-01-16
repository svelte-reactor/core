/**
 * Performance Demo: Debounced Persistence
 *
 * Demonstrates how debouncing reduces I/O operations
 * while maintaining data integrity.
 */

import { createReactor } from '../../src/core/reactor.svelte.js';
import { persist } from '../../src/plugins/persist-plugin.js';

export async function demoDebounce() {
  console.log('=== Debounced Persistence Demo ===\n');

  let writeCount = 0;

  // Mock storage to count writes
  const mockStorage: Storage = {
    getItem: () => null,
    setItem: () => {
      writeCount++;
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };

  // ❌ No debounce (writes on every update)
  console.log('❌ No Debounce:');
  writeCount = 0;

  const store1 = createReactor(
    { text: '' },
    {
      plugins: [
        persist({
          key: 'text1',
          debounce: 0,
          storage: mockStorage as any,
        }),
      ],
    }
  );

  // Simulate user typing "hello"
  'hello'.split('').forEach((char) => {
    store1.update((s) => {
      s.text += char;
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  console.log(`  User typed "hello"`);
  console.log(`  Storage writes: ${writeCount}`);
  console.log(`  I/O operations: ${writeCount} × ~1ms = ${writeCount}ms`);

  // ✅ With debounce (batches writes)
  console.log('\n✅ With Debounce (500ms):');
  writeCount = 0;

  const store2 = createReactor(
    { text: '' },
    {
      plugins: [
        persist({
          key: 'text2',
          debounce: 500,
          storage: mockStorage as any,
        }),
      ],
    }
  );

  // Simulate user typing "hello"
  'hello'.split('').forEach((char, i) => {
    setTimeout(() => {
      store2.update((s) => {
        s.text += char;
      });
    }, i * 50); // 50ms between keystrokes
  });

  // Wait for debounce to complete
  await new Promise((resolve) => setTimeout(resolve, 800));

  console.log(`  User typed "hello"`);
  console.log(`  Storage writes: ${writeCount}`);
  console.log(`  I/O operations: ${writeCount} × ~1ms = ${writeCount}ms`);

  const savings = ((4 - writeCount) / 4) * 100;
  console.log(`\n📊 I/O Reduction: ${savings.toFixed(0)}%`);
  console.log(`   ${Math.floor(5 / (writeCount || 1))}x fewer writes!\n`);

  // Cleanup
  store1.destroy();
  store2.destroy();
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demoDebounce();
}
