/**
 * IndexedDB Storage Adapter for svelte-reactor
 * Provides persistent storage with much larger capacity than localStorage
 */

export interface IndexedDBConfig {
  /**
   * Database name
   * @default 'svelte-reactor'
   */
  database?: string;

  /**
   * Object store name
   * @default 'state'
   */
  storeName?: string;

  /**
   * Database version
   * @default 1
   */
  version?: number;
}

export interface QuotaInfo {
  usage: number;
  quota: number;
  percentage: number;
}

/**
 * IndexedDB Storage Adapter
 *
 * Provides a localStorage-like API backed by IndexedDB
 * with much larger storage capacity (50MB+ depending on browser)
 */
export class IndexedDBStorage {
  private dbName: string;
  private storeName: string;
  private version: number;
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;

  constructor(config: IndexedDBConfig = {}) {
    this.dbName = config.database || 'svelte-reactor';
    this.storeName = config.storeName || 'state';
    this.version = config.version || 1;
    this.ready = this.init();
  }

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error(
        `[IndexedDBStorage] IndexedDB is not available in this environment.\n` +
        `  Environment: ${typeof window === 'undefined' ? 'Server-side (SSR)' : 'Browser without IndexedDB support'}\n\n` +
        `Possible solutions:\n` +
        `  1. Use memory storage for SSR: persist({ storage: 'memory' })\n` +
        `  2. Use localStorage as fallback: persist({ storage: 'localStorage' })\n` +
        `  3. Check browser compatibility: IndexedDB requires modern browsers\n\n` +
        `Tip: Detect environment before using IndexedDB:\n` +
        `  if (typeof indexedDB !== 'undefined') {\n` +
        `    // Use IndexedDB\n` +
        `  } else {\n` +
        `    // Use fallback storage\n` +
        `  }`
      );
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  /**
   * Get item from storage
   */
  async getItem(key: string): Promise<string | null> {
    await this.ready;

    if (!this.db) {
      throw new Error(
        `[IndexedDBStorage:getItem] Database not initialized.\n` +
        `  Database: ${this.dbName}\n` +
        `  Store: ${this.storeName}\n` +
        `  Key: ${key}\n\n` +
        `Possible causes:\n` +
        `  1. Database failed to open (check browser console for errors)\n` +
        `  2. User denied storage permission\n` +
        `  3. Private browsing mode may restrict IndexedDB\n\n` +
        `Tip: Wait for initialization:\n` +
        `  const storage = new IndexedDBStorage();\n` +
        `  await storage.ready; // Wait for init\n` +
        `  const value = await storage.getItem(key);`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error(`Failed to get item: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  /**
   * Set item in storage
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.ready;

    if (!this.db) {
      throw new Error(
        `[IndexedDBStorage:setItem] Database not initialized.\n` +
        `  Database: ${this.dbName}\n` +
        `  Store: ${this.storeName}\n` +
        `  Key: ${key}\n\n` +
        `Possible causes:\n` +
        `  1. Database failed to open (check browser console for errors)\n` +
        `  2. User denied storage permission\n` +
        `  3. Private browsing mode may restrict IndexedDB\n\n` +
        `Tip: Check storage quota if writes are failing:\n` +
        `  const quota = await storage.getQuota();\n` +
        `  console.log('Storage used:', quota.percentage + '%');`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => {
        reject(new Error(`Failed to set item: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    await this.ready;

    if (!this.db) {
      throw new Error(
        `[IndexedDBStorage:removeItem] Database not initialized.\n` +
        `  Database: ${this.dbName}\n` +
        `  Store: ${this.storeName}\n` +
        `  Key: ${key}\n\n` +
        `Possible causes:\n` +
        `  1. Database failed to open (check browser console for errors)\n` +
        `  2. User denied storage permission\n` +
        `  3. Private browsing mode may restrict IndexedDB`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        reject(new Error(`Failed to remove item: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all items from storage
   */
  async clear(): Promise<void> {
    await this.ready;

    if (!this.db) {
      throw new Error(
        `[IndexedDBStorage:clear] Database not initialized.\n` +
        `  Database: ${this.dbName}\n` +
        `  Store: ${this.storeName}\n\n` +
        `Possible causes:\n` +
        `  1. Database failed to open (check browser console for errors)\n` +
        `  2. User denied storage permission\n` +
        `  3. Private browsing mode may restrict IndexedDB`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear storage: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get all keys in storage
   */
  async keys(): Promise<string[]> {
    await this.ready;

    if (!this.db) {
      throw new Error(
        `[IndexedDBStorage:keys] Database not initialized.\n` +
        `  Database: ${this.dbName}\n` +
        `  Store: ${this.storeName}\n\n` +
        `Possible causes:\n` +
        `  1. Database failed to open (check browser console for errors)\n` +
        `  2. User denied storage permission\n` +
        `  3. Private browsing mode may restrict IndexedDB`
      );
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => {
        reject(new Error(`Failed to get keys: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
    });
  }

  /**
   * Get storage quota information
   */
  async getQuota(): Promise<QuotaInfo | null> {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        percentage
      };
    } catch (error) {
      console.warn('Failed to get storage quota:', error);
      return null;
    }
  }

  /**
   * Check if storage quota is exceeded
   */
  async isQuotaExceeded(): Promise<boolean> {
    const quota = await this.getQuota();
    if (!quota) return false;

    // Consider quota exceeded if usage is > 90%
    return quota.percentage > 90;
  }

  /**
   * Get storage usage in bytes
   */
  async getUsage(): Promise<number> {
    const quota = await this.getQuota();
    return quota?.usage || 0;
  }

  /**
   * Get available storage in bytes
   */
  async getAvailable(): Promise<number> {
    const quota = await this.getQuota();
    if (!quota) return 0;
    return Math.max(0, quota.quota - quota.usage);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Delete the entire database
   */
  static async deleteDatabase(dbName: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error(
        `[IndexedDBStorage:deleteDatabase] IndexedDB is not available in this environment.\n` +
        `  Environment: ${typeof window === 'undefined' ? 'Server-side (SSR)' : 'Browser without IndexedDB support'}\n\n` +
        `Tip: This operation requires a browser environment with IndexedDB support.`
      );
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);

      request.onerror = () => {
        reject(new Error(`Failed to delete database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };

      request.onblocked = () => {
        console.warn(`Database deletion blocked. Close all tabs using this database.`);
      };
    });
  }
}

/**
 * Create a localStorage-compatible wrapper around IndexedDBStorage
 *
 * This provides a synchronous-like API that matches localStorage,
 * but operations happen asynchronously in the background.
 *
 * SAFETY: All pending async operations are tracked and can be flushed
 * before closing to guarantee data persistence.
 */
export class IndexedDBStorageSync {
  private storage: IndexedDBStorage;
  private cache: Map<string, string> = new Map();
  private pendingOperations: Set<Promise<void>> = new Set();

  /**
   * Promise that resolves when the cache is loaded from IndexedDB.
   * Wait for this before reading data to ensure persistence works correctly.
   */
  readonly ready: Promise<void>;

  constructor(config: IndexedDBConfig = {}) {
    this.storage = new IndexedDBStorage(config);
    this.ready = this.loadCache();
  }

  /**
   * Load all data into cache for synchronous access
   */
  private async loadCache(): Promise<void> {
    try {
      const keys = await this.storage.keys();
      await Promise.all(
        keys.map(async (key) => {
          const value = await this.storage.getItem(key);
          if (value !== null) {
            this.cache.set(key, value);
          }
        })
      );
    } catch (error) {
      console.error('Failed to load IndexedDB cache:', error);
    }
  }

  /**
   * Get item synchronously from cache
   */
  getItem(key: string): string | null {
    return this.cache.get(key) || null;
  }

  /**
   * Set item (updates cache immediately, persists asynchronously)
   */
  setItem(key: string, value: string): void {
    this.cache.set(key, value);

    // Persist asynchronously and track the operation
    const operation = this.storage.setItem(key, value)
      .catch((error) => {
        console.error(`Failed to persist to IndexedDB:`, error);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });

    this.pendingOperations.add(operation);
  }

  /**
   * Remove item (updates cache immediately, persists asynchronously)
   */
  removeItem(key: string): void {
    this.cache.delete(key);

    // Persist asynchronously and track the operation
    const operation = this.storage.removeItem(key)
      .catch((error) => {
        console.error(`Failed to remove from IndexedDB:`, error);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });

    this.pendingOperations.add(operation);
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.cache.clear();

    // Persist asynchronously and track the operation
    const operation = this.storage.clear()
      .catch((error) => {
        console.error(`Failed to clear IndexedDB:`, error);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });

    this.pendingOperations.add(operation);
  }

  /**
   * Get quota info
   */
  async getQuota(): Promise<QuotaInfo | null> {
    return this.storage.getQuota();
  }

  /**
   * Flush all pending operations
   * Waits for all async writes to complete
   *
   * @returns Promise that resolves when all pending operations are complete
   */
  async flush(): Promise<void> {
    if (this.pendingOperations.size === 0) {
      return;
    }

    // Wait for all pending operations to complete
    await Promise.all(Array.from(this.pendingOperations));
  }

  /**
   * Close the database
   * Automatically flushes all pending operations before closing
   */
  async close(): Promise<void> {
    // Wait for all pending operations to complete
    await this.flush();

    // Close the database connection
    this.storage.close();
  }
}
