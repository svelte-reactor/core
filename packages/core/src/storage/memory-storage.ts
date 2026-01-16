/**
 * In-Memory Storage Adapter for svelte-reactor
 * Provides a localStorage-like API that stores data in memory
 *
 * Use cases:
 * - Testing without affecting real storage
 * - SSR (server-side rendering) compatibility
 * - Temporary state that shouldn't persist across page reloads
 * - Shared state within a single page session
 */

/**
 * MemoryStorage - In-memory storage implementation
 *
 * Implements the Web Storage API interface, making it compatible
 * with localStorage/sessionStorage but stores data in memory.
 *
 * Data is:
 * - Shared across all MemoryStorage instances (singleton pattern)
 * - Lost on page reload
 * - NOT persisted to disk
 * - Safe to use in SSR environments
 */
export class MemoryStorage implements Storage {
  private static store = new Map<string, string>();

  /**
   * Get item from memory storage
   */
  getItem(key: string): string | null {
    return MemoryStorage.store.get(key) ?? null;
  }

  /**
   * Set item in memory storage
   */
  setItem(key: string, value: string): void {
    MemoryStorage.store.set(key, value);
  }

  /**
   * Remove item from memory storage
   */
  removeItem(key: string): void {
    MemoryStorage.store.delete(key);
  }

  /**
   * Clear all items from memory storage
   */
  clear(): void {
    MemoryStorage.store.clear();
  }

  /**
   * Get key at index
   */
  key(index: number): string | null {
    const keys = Array.from(MemoryStorage.store.keys());
    return keys[index] ?? null;
  }

  /**
   * Get number of items in storage
   */
  get length(): number {
    return MemoryStorage.store.size;
  }
}

/**
 * Global instance for convenience
 * Use this if you want a shared in-memory storage across your app
 */
export const memoryStorage = new MemoryStorage();
