/**
 * Persisted store helper - wraps createReactor with persist plugin
 */

import { createReactor } from '../core/reactor.svelte.js';
import { persist } from '../plugins/persist-plugin.js';
import type { PersistOptions, ReactorOptions } from '../types/index.js';
import type { WritableStore } from './simple-store.js';
import { createValueStoreFromReactor } from './value-store-factory.js';

/**
 * Options for persisted store
 */
export interface PersistedStoreOptions extends Omit<PersistOptions, 'key'> {
  /** Additional reactor options (without plugins, as persist is auto-added) */
  reactorOptions?: Omit<ReactorOptions<any>, 'plugins'>;

  /** Additional plugins to add alongside persist plugin */
  additionalPlugins?: ReactorOptions<any>['plugins'];
}

/**
 * Create a persisted store that automatically saves to storage
 * Compatible with Svelte stores API
 *
 * @example
 * ```ts
 * import { persistedStore } from 'svelte-reactor/helpers';
 *
 * // Simple usage
 * const counter = persistedStore('counter', 0);
 *
 * // With options
 * const settings = persistedStore('settings', { theme: 'dark' }, {
 *   storage: 'localStorage',
 *   debounce: 300,
 *   serialize: (state) => ({ theme: state.theme }), // Only persist theme
 * });
 * ```
 */
export function persistedStore<T>(
  key: string,
  initialValue: T,
  options?: PersistedStoreOptions
): WritableStore<T> {
  const { reactorOptions, additionalPlugins, ...persistOptions } = options || {};

  // Check if we're in SSR context
  const isClient = typeof window !== 'undefined';

  // Merge plugins
  const plugins = [
    ...(isClient ? [persist({ key, ...persistOptions })] : []),
    ...(additionalPlugins || []),
  ];

  // Create reactor with persist plugin (only on client)
  const reactor = createReactor(
    { value: initialValue },
    {
      ...reactorOptions,
      plugins,
    }
  );

  return createValueStoreFromReactor(reactor);
}

/**
 * Create a persisted reactor (full reactor API with persistence)
 * For complex state management with undo/redo and history
 *
 * @example
 * ```ts
 * import { persistedReactor } from 'svelte-reactor/helpers';
 * import { undoRedo } from 'svelte-reactor/plugins';
 *
 * const store = persistedReactor(
 *   'app-state',
 *   { count: 0, user: { name: 'John' } },
 *   {
 *     storage: 'localStorage',
 *     omit: ['user.token'], // Don't persist token
 *     reactorOptions: {
 *       plugins: [undoRedo()], // Add undo/redo
 *     },
 *   }
 * );
 * ```
 */
export function persistedReactor<T extends object>(
  key: string,
  initialState: T,
  options?: PersistedStoreOptions
) {
  const { reactorOptions, additionalPlugins, ...persistOptions } = options || {};

  // Check if we're in SSR context
  const isClient = typeof window !== 'undefined';

  // Merge plugins (persist + any additional plugins)
  const plugins = [
    ...(isClient ? [persist({ key, ...persistOptions })] : []),
    ...(additionalPlugins || []),
  ];

  return createReactor(initialState, {
    ...reactorOptions,
    plugins,
  });
}
