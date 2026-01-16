/**
 * Persist plugin - direct storage integration
 */

import type { ReactorPlugin, PersistOptions, Middleware } from '../types/index.js';
import { deepClone } from '../utils/index.js';
import { pick, omit } from '../utils/path.js';
import { IndexedDBStorageSync } from '../storage/indexeddb.js';
import { memoryStorage } from '../storage/memory-storage.js';

// Lazy-loaded lz-string module (only loaded when compress: true)
// This allows tree-shaking when compression is not used
let lzStringModule: typeof import('lz-string') | null = null;
let lzStringLoadPromise: Promise<typeof import('lz-string')> | null = null;

/**
 * Ensure lz-string is loaded (async load, cached)
 * Called when persist plugin is created with compress: true
 */
async function ensureLzStringLoaded(): Promise<void> {
  if (lzStringModule) return;
  if (!lzStringLoadPromise) {
    lzStringLoadPromise = import('lz-string');
  }
  lzStringModule = await lzStringLoadPromise;
}

/**
 * Enable state persistence using direct storage access
 *
 * @example
 * ```ts
 * import { persist } from 'svelte-reactor/plugins';
 *
 * const reactor = createReactor(state, {
 *   plugins: [persist({ key: 'my-state' })],
 * });
 * ```
 */
export function persist<T extends object>(options: PersistOptions): ReactorPlugin<T> {
  // Validate required options
  if (!options || typeof options !== 'object') {
    throw new TypeError('[persist] options must be an object');
  }

  if (!options.key || typeof options.key !== 'string') {
    throw new TypeError('[persist] options.key is required and must be a non-empty string');
  }

  const {
    key,
    storage = 'localStorage',
    debounce = 0,
    compress = false,
    version,
    migrations,
    serialize,
    deserialize,
    pick: pickPaths,
    omit: omitPaths,
    ttl,
    onExpire,
    onReady,
  } = options;

  // Validate debounce
  if (typeof debounce !== 'number' || debounce < 0) {
    throw new TypeError(`[persist] options.debounce must be a non-negative number, got ${debounce}`);
  }

  // Validate TTL
  if (ttl !== undefined && (typeof ttl !== 'number' || ttl < 0)) {
    throw new TypeError(`[persist] options.ttl must be a non-negative number, got ${ttl}`);
  }

  // Validate storage type
  const VALID_STORAGE_TYPES = ['localStorage', 'sessionStorage', 'indexedDB', 'memory'] as const;
  if (!VALID_STORAGE_TYPES.includes(storage as any)) {
    throw new TypeError(
      `[persist] Invalid storage type: "${storage}". ` +
      `Must be one of: ${VALID_STORAGE_TYPES.join(', ')}`
    );
  }

  let debounceTimer: any;
  let storageBackend: Storage | IndexedDBStorageSync | null = null;
  let storageListener: ((e: StorageEvent) => void) | null = null;
  let indexedDBInstance: IndexedDBStorageSync | null = null;

  // Pre-load lz-string if compression is enabled (non-blocking)
  // This starts loading immediately when persist() is called
  if (compress) {
    ensureLzStringLoaded().catch((error) => {
      console.error(`[persist:${key}] Failed to load lz-string:`, error);
    });
  }

  // Get storage backend
  function getStorage(): Storage | IndexedDBStorageSync | null {
    // Memory storage works in any environment (SSR-safe)
    if (storage === 'memory') {
      return memoryStorage;
    }

    // Other storage types require browser environment
    if (typeof window === 'undefined') return null;

    switch (storage) {
      case 'localStorage':
        return window.localStorage;
      case 'sessionStorage':
        return window.sessionStorage;
      case 'indexedDB':
        // Create IndexedDB storage instance
        try {
          indexedDBInstance = new IndexedDBStorageSync(options.indexedDB || {});
          return indexedDBInstance;
        } catch (error) {
          console.error(`[persist:${key}] Failed to initialize IndexedDB:`, error);
          return null;
        }
      default:
        return window.localStorage;
    }
  }

  // Load state from storage
  function loadState(): T | null {
    if (!storageBackend) return null;

    try {
      const item = storageBackend.getItem(key);
      if (!item) return null;

      // Handle decompression
      let jsonString: string;
      if (compress) {
        if (!lzStringModule) {
          // lz-string not loaded yet, try to parse as uncompressed (backward compatibility)
          console.warn(`[persist:${key}] lz-string not loaded, trying uncompressed data`);
          jsonString = item;
        } else {
          // Decompress from UTF16
          try {
            const decompressed = lzStringModule.decompressFromUTF16(item);
            if (decompressed) {
              // Validate decompressed data is valid JSON
              try {
                JSON.parse(decompressed);
                jsonString = decompressed;
              } catch {
                // Decompression returned garbage - use original (backward compatibility)
                console.warn(`[persist:${key}] Decompressed data is invalid, using uncompressed fallback`);
                jsonString = item;
              }
            } else {
              // Decompression returned null - try direct parse (backward compatibility)
              console.warn(`[persist:${key}] Failed to decompress, trying uncompressed fallback`);
              jsonString = item;
            }
          } catch (error) {
            console.warn(`[persist:${key}] Decompression error, using uncompressed fallback:`, error);
            jsonString = item;
          }
        }
      } else {
        jsonString = item;
      }

      let data = JSON.parse(jsonString);

      // Check TTL expiration
      if (ttl !== undefined && data.__timestamp) {
        const now = Date.now();
        const age = now - data.__timestamp;

        if (age >= ttl) {
          // Data has expired
          console.warn(`[persist:${key}] Data expired (age: ${age}ms, ttl: ${ttl}ms)`);

          // Call onExpire callback if provided
          if (onExpire) {
            try {
              onExpire(key);
            } catch (error) {
              console.error(`[persist:${key}] Error in onExpire callback:`, error);
            }
          }

          // Remove expired data
          try {
            storageBackend.removeItem(key);
          } catch {
            // Ignore removal errors
          }

          return null;
        }
      }

      // Handle migrations
      if (version && migrations && data.__version !== version) {
        const currentVersion = data.__version || 0;
        for (let v = currentVersion + 1; v <= version; v++) {
          if (migrations[v]) {
            data = migrations[v](data);
          }
        }
        data.__version = version;
      }

      // Custom deserializer (apply before removing metadata)
      let result = data;
      if (deserialize) {
        result = deserialize(data);
      }

      // Remove internal metadata before returning
      // Need to check if result is an object to avoid errors
      if (result && typeof result === 'object') {
        const { __timestamp, __version, ...cleanData } = result as any;
        return cleanData as T;
      }

      return result as T;
    } catch (error) {
      console.error(`[persist:${key}] Failed to load state from ${storage}:`, error);
      // Try to recover by clearing corrupted data
      try {
        storageBackend?.removeItem(key);
        console.warn(`[persist:${key}] Cleared corrupted data from storage`);
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
  }

  // Save state to storage
  function saveState(state: T): void {
    if (!storageBackend) return;

    try {
      // Deep clone to handle Proxy objects from Svelte 5
      let data: any = deepClone(state);

      // Apply pick/omit if specified
      if (pickPaths) {
        data = pick(data, pickPaths);
      } else if (omitPaths && omitPaths.length > 0) {
        data = omit(data, omitPaths);
      }

      // Custom serializer
      if (serialize) {
        data = serialize(data);
      }

      // Add version
      if (version) {
        data.__version = version;
      }

      // Add timestamp for TTL
      if (ttl !== undefined) {
        data.__timestamp = Date.now();
      }

      const jsonString = JSON.stringify(data);

      // Handle compression
      let finalString: string;
      if (compress && lzStringModule) {
        // Compress to UTF16 (safe for all storage types)
        finalString = lzStringModule.compressToUTF16(jsonString);
      } else {
        finalString = jsonString;
      }

      storageBackend.setItem(key, finalString);
    } catch (error) {
      // Check if quota exceeded
      const isQuotaExceeded =
        error instanceof DOMException &&
        (error.code === 22 || // Chrome
         error.code === 1014 || // Firefox
         error.name === 'QuotaExceededError' ||
         error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

      if (isQuotaExceeded) {
        console.error(`[persist:${key}] Storage quota exceeded in ${storage}. Consider using compression or clearing old data.`, error);
      } else {
        console.error(`[persist:${key}] Failed to save state to ${storage}:`, error);
      }
    }
  }

  return {
    name: 'persist',

    init(context) {
      // Initialize storage backend
      storageBackend = getStorage();

      // Helper function to apply loaded state and call onReady
      const applyLoadedState = (loadedState: T | null) => {
        if (loadedState) {
          Object.assign(context.state, loadedState);
        }

        // Call onReady callback if provided
        if (onReady) {
          try {
            onReady(loadedState);
          } catch (error) {
            console.error(`[persist:${key}] Error in onReady callback:`, error);
          }
        }
      };

      // For IndexedDB, we need to wait for the cache to be ready before loading
      if (storage === 'indexedDB' && indexedDBInstance) {
        // Load state asynchronously after IndexedDB cache is populated
        indexedDBInstance.ready
          .then(() => {
            const loadedState = loadState();
            applyLoadedState(loadedState);
          })
          .catch((error) => {
            console.error(`[persist:${key}] Failed to initialize IndexedDB:`, error);
            applyLoadedState(null);
          });
      } else {
        // For other storage types, load synchronously
        const loadedState = loadState();
        applyLoadedState(loadedState);
      }

      // Create middleware to sync changes
      const persistMiddleware: Middleware<T> = {
        name: 'persist-sync',

        onAfterUpdate(prevState, nextState) {
          // Debounce if needed
          if (debounce > 0) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              saveState(nextState);
            }, debounce);
          } else {
            saveState(nextState);
          }
        },
      };

      // Register middleware
      context.middlewares.push(persistMiddleware);

      // Listen for storage changes from other tabs/windows (localStorage only)
      // or from manual changes in DevTools (both localStorage and sessionStorage)
      if (typeof window !== 'undefined' && storageBackend) {
        storageListener = (e: StorageEvent) => {
          // Only react to changes for our key
          if (e.key !== key) return;

          // Ignore changes from the same window (we already updated)
          if (e.storageArea !== storageBackend) return;

          // Load and apply the new state
          const newState = loadState();
          if (newState) {
            Object.assign(context.state, newState);
          }
        };

        window.addEventListener('storage', storageListener);
      }
    },

    destroy() {
      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Remove storage event listener
      if (storageListener && typeof window !== 'undefined') {
        window.removeEventListener('storage', storageListener);
        storageListener = null;
      }

      // Close IndexedDB connection (flushes pending operations first)
      if (indexedDBInstance) {
        // Note: close() is async and flushes all pending writes before closing
        // This ensures data integrity even if the app closes immediately after
        indexedDBInstance.close().catch((error) => {
          console.error(`[persist:${key}] Error closing IndexedDB:`, error);
        });
        indexedDBInstance = null;
      }
    },
  };
}
