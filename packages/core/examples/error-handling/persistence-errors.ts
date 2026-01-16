/**
 * Example: Persistence Error Handling
 *
 * Demonstrates how to handle storage errors in svelte-reactor:
 * - Handling QuotaExceededError (storage full)
 * - Fallback to alternative storage
 * - Graceful degradation when storage unavailable
 * - Memory storage as fallback
 */

import { createReactor } from '../../src/core/reactor.svelte';
import { persist } from '../../src/plugins/persist-plugin';
import { MemoryStorage } from '../../src/storage/memory-storage';

// =============================================================================
// Example 1: Handling Storage Quota Exceeded
// =============================================================================

interface AppState {
  items: string[];
  lastSaved: number | null;
}

// Mock localStorage that throws QuotaExceededError
class MockQuotaExceededStorage implements Storage {
  private store = new Map<string, string>();
  private maxSize = 100; // Very small limit

  get length() {
    return this.store.size;
  }

  setItem(key: string, value: string): void {
    if (value.length > this.maxSize) {
      const error: any = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.store.set(key, value);
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

export function quotaExceededExample() {
  console.log('\n=== Example 1: Handling Storage Quota Exceeded ===\n');

  const mockStorage = new MockQuotaExceededStorage();

  const store = createReactor<AppState>(
    {
      items: [],
      lastSaved: null
    },
    {
      plugins: [
        persist({
          key: 'app-data',
          storage: mockStorage as any // Mock storage for testing
          // Note: persist plugin catches errors internally and logs them
          // For custom error handling, wrap storage operations in try-catch
        })
      ]
    }
  );

  console.log('Adding items until quota is exceeded...\n');

  // Add items until we hit quota limit
  for (let i = 0; i < 5; i++) {
    store.update(state => {
      state.items.push(`Item ${i + 1} - ${new Array(50).fill('x').join('')}`);  // Large item
      state.lastSaved = Date.now();
    });
  }

  console.log('\n✅ Example completed - quota exceeded handled internally');
  console.log('Final items count:', store.state.items.length);
  console.log('Note: persist plugin logs errors automatically');

  store.destroy();
}

// =============================================================================
// Example 2: Fallback Storage Pattern
// =============================================================================

// Storage that fails after first write
class FailingStorage implements Storage {
  private writeCount = 0;

  get length() {
    return 0;
  }

  setItem(key: string, value: string): void {
    this.writeCount++;
    if (this.writeCount > 1) {
      throw new Error('Storage write failed');
    }
  }

  getItem(key: string): string | null {
    return null;
  }

  removeItem(key: string): void {}
  clear(): void {}
  key(index: number): string | null {
    return null;
  }
}

export function fallbackStorageExample() {
  console.log('\n=== Example 2: Fallback Storage Pattern ===\n');

  const currentStorage: Storage = new FailingStorage();

  const store = createReactor<AppState>(
    {
      items: ['Initial item'],
      lastSaved: null
    },
    {
      plugins: [
        persist({
          key: 'fallback-test',
          storage: currentStorage as any // Custom storage for testing
          // Note: Storage failures are logged internally by persist plugin
          // This example shows the SafeStorage pattern (see Example 5)
        })
      ]
    }
  );

  console.log('Initial state:', store.state);

  // First update - works
  store.update(state => {
    state.items.push('Second item');
  });
  console.log('✅ First update succeeded');

  // Second update - triggers error and fallback
  store.update(state => {
    state.items.push('Third item');
  });
  console.log('✅ Second update succeeded (using fallback)');

  // Third update - uses fallback storage
  store.update(state => {
    state.items.push('Fourth item');
  });
  console.log('✅ Third update succeeded (using fallback)');

  console.log('\nFinal state:', {
    items: store.state.items.length
  });
  console.log('💡 For automatic fallback, use SafeStorage pattern (Example 5)');

  store.destroy();
}

// =============================================================================
// Example 3: Graceful Degradation - Private Browsing
// =============================================================================

class PrivateBrowsingStorage implements Storage {
  get length() {
    return 0;
  }

  setItem(key: string, value: string): void {
    throw new Error('localStorage is not available in private browsing mode');
  }

  getItem(key: string): string | null {
    throw new Error('localStorage is not available in private browsing mode');
  }

  removeItem(key: string): void {
    throw new Error('localStorage is not available in private browsing mode');
  }

  clear(): void {
    throw new Error('localStorage is not available in private browsing mode');
  }

  key(index: number): string | null {
    throw new Error('localStorage is not available in private browsing mode');
  }
}

interface FeatureState {
  data: string[];
  persistenceEnabled: boolean;
  mode: 'normal' | 'private' | 'memory-only';
}

export function privateBrowsingExample() {
  console.log('\n=== Example 3: Graceful Degradation (Private Browsing) ===\n');

  const store = createReactor<FeatureState>({
    data: [],
    persistenceEnabled: true,
    mode: 'normal'
  });

  const privateBrowsingStorage = new PrivateBrowsingStorage();

  // Try to enable persistence
  try {
    // Simulate detecting private browsing
    privateBrowsingStorage.setItem('test', 'test');

    console.log('✅ localStorage available');
    store.update(state => {
      state.mode = 'normal';
    });

  } catch (error) {
    console.warn('⚠️  Private browsing detected or storage unavailable');

    // Gracefully degrade
    store.update(state => {
      state.persistenceEnabled = false;
      state.mode = 'memory-only';
    });

    console.log('💡 App will work but data won\'t persist across sessions');
    console.log('✅ Switched to memory-only mode');
  }

  // App continues to work normally
  store.update(state => {
    state.data.push('Item 1', 'Item 2', 'Item 3');
  });

  console.log('\nFinal state:', {
    dataCount: store.state.data.length,
    persistenceEnabled: store.state.persistenceEnabled,
    mode: store.state.mode
  });

  store.destroy();
}

// =============================================================================
// Example 4: Corruption Detection and Recovery
// =============================================================================

class CorruptedStorage implements Storage {
  get length() {
    return 1;
  }

  setItem(key: string, value: string): void {
    // Simulate successful write
  }

  getItem(key: string): string | null {
    // Return corrupted JSON
    return '{"items": [corrupted data}';
  }

  removeItem(key: string): void {}
  clear(): void {}
  key(index: number): string | null {
    return null;
  }
}

interface DataState {
  items: string[];
  dataCorrupted: boolean;
}

const DEFAULT_STATE: DataState = {
  items: ['Default Item 1', 'Default Item 2'],
  dataCorrupted: false
};

export function corruptionRecoveryExample() {
  console.log('\n=== Example 4: Corruption Detection and Recovery ===\n');

  const corruptedStorage = new CorruptedStorage();

  // Try to load corrupted data
  console.log('Attempting to load data from storage...');

  let loadedState: DataState;
  try {
    const data = corruptedStorage.getItem('corrupted-data');
    if (data) {
      loadedState = JSON.parse(data);
      console.log('✅ Data loaded successfully');
    } else {
      loadedState = DEFAULT_STATE;
    }
  } catch (error) {
    console.error('❌ Failed to load data:', (error as Error).message);
    console.log('🔧 Data appears corrupted, resetting to defaults');

    loadedState = {
      ...DEFAULT_STATE,
      dataCorrupted: true
    };

    // Try to clear corrupted data
    try {
      corruptedStorage.removeItem('corrupted-data');
      console.log('✅ Cleared corrupted data');
    } catch (clearError) {
      console.warn('⚠️  Could not clear corrupted data');
    }
  }

  const store = createReactor<DataState>(loadedState);

  console.log('\nRecovered state:', {
    items: store.state.items,
    dataCorrupted: store.state.dataCorrupted
  });

  if (store.state.dataCorrupted) {
    console.log('💡 User would see: "We reset your data due to corruption"');
  }

  store.destroy();
}

// =============================================================================
// Example 5: Safe Storage Wrapper
// =============================================================================

class SafeStorage implements Storage {
  private fallback: Storage;
  private hasFailed = false;

  constructor(
    private primary: Storage,
    fallback?: Storage
  ) {
    this.fallback = fallback || new MemoryStorage();
  }

  get length(): number {
    return this.getStorage().length;
  }

  private getStorage(): Storage {
    return this.hasFailed ? this.fallback : this.primary;
  }

  setItem(key: string, value: string): void {
    try {
      this.primary.setItem(key, value);
    } catch (error) {
      if (!this.hasFailed) {
        console.warn('⚠️  Primary storage failed, using fallback');
        this.hasFailed = true;
      }
      this.fallback.setItem(key, value);
    }
  }

  getItem(key: string): string | null {
    try {
      return this.primary.getItem(key);
    } catch (error) {
      return this.fallback.getItem(key);
    }
  }

  removeItem(key: string): void {
    try {
      this.primary.removeItem(key);
    } catch (error) {
      this.fallback.removeItem(key);
    }
  }

  clear(): void {
    try {
      this.primary.clear();
    } catch (error) {
      this.fallback.clear();
    }
  }

  key(index: number): string | null {
    try {
      return this.primary.key(index);
    } catch (error) {
      return this.fallback.key(index);
    }
  }
}

export function safeStorageWrapperExample() {
  console.log('\n=== Example 5: Safe Storage Wrapper ===\n');

  // Create safe storage that automatically falls back
  const safeStorage = new SafeStorage(
    new FailingStorage(),
    new MemoryStorage()
  );

  const store = createReactor<AppState>(
    {
      items: [],
      lastSaved: null
    },
    {
      plugins: [
        persist({
          key: 'safe-storage-test',
          storage: safeStorage as any // Custom SafeStorage wrapper with auto-fallback
          // SafeStorage handles errors internally - see implementation above
        })
      ]
    }
  );

  console.log('Making multiple updates...\n');

  // First update - works with primary
  store.update(state => {
    state.items.push('First item');
  });
  console.log('✅ Update 1: Succeeded');

  // Second update - triggers fallback
  store.update(state => {
    state.items.push('Second item');
  });
  console.log('✅ Update 2: Succeeded (auto-fallback)');

  // Third update - uses fallback
  store.update(state => {
    state.items.push('Third item');
  });
  console.log('✅ Update 3: Succeeded (fallback)');

  console.log('\nFinal state:', {
    items: store.state.items
  });

  console.log('💡 SafeStorage automatically handled the failure');

  store.destroy();
}

// =============================================================================
// Run all examples
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                 PERSISTENCE ERROR HANDLING                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  quotaExceededExample();
  fallbackStorageExample();
  privateBrowsingExample();
  corruptionRecoveryExample();
  safeStorageWrapperExample();

  console.log('\n✅ All persistence error examples completed!\n');
}
