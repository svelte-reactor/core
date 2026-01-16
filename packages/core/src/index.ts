/**
 * svelte-reactor
 * Powerful reactive state management for Svelte 5
 */

// Core
export { createReactor } from './core/reactor.svelte.js';
export { ReactorError, type ReactorErrorContext } from './core/reactor-error.js';

// Helpers (convenient wrappers)
export { simpleStore, persistedStore, persistedReactor, arrayActions, arrayPagination, asyncActions, computedStore } from './helpers/index.js';

// Types
export type {
  Reactor,
  ReactorOptions,
  ReactorPlugin,
  PluginContext,
  Middleware,
  HistoryEntry,
  HistoryStack,
  UndoRedoHistory,
  ReactorInspection,
  UndoRedoOptions,
  PersistOptions,
  StorageType,
  LoggerOptions,
  SyncOptions,
  ReactorDevTools,
  Subscriber,
  Unsubscriber,
  SelectiveSubscribeOptions,
} from './types/index.js';

// Helper types
export type { WritableStore, PersistedStoreOptions, ArrayActions, ArrayActionsOptions, ArrayPagination, ArrayPaginationOptions, PaginatedResult, AsyncActions, AsyncActionOptions, AsyncState, ComputedStoreOptions } from './helpers/index.js';

// DevTools
export { createDevTools } from './devtools/index.js';

// Batch utilities
export { batched, debouncedBatch } from './utils/batch.js';

// Svelte store utilities
// Re-export from svelte/store for convenience - all svelte-reactor stores are compatible
export { derived, get, readonly } from 'svelte/store';
export type { Readable } from 'svelte/store';

// Utility functions
export { isEqual } from './utils/clone.js';
