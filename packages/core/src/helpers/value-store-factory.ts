/**
 * Factory for creating value stores from reactors
 * Eliminates code duplication between simpleStore and persistedStore
 */

import type { Reactor, Subscriber, Unsubscriber } from '../types/index.js';
import type { WritableStore } from './simple-store.js';

/**
 * Create a WritableStore from a reactor with { value: T } state shape
 * @internal
 */
export function createValueStoreFromReactor<T>(
  reactor: Reactor<{ value: T }>
): WritableStore<T> {
  const store: WritableStore<T> = {
    subscribe: (subscriber: Subscriber<T>): Unsubscriber => {
      return reactor.subscribe((state) => {
        subscriber(state.value);
      });
    },

    set: (value: T): void => {
      reactor.set({ value });
    },

    update: (updater: (value: T) => T): void => {
      const newValue = updater(reactor.state.value);
      reactor.set({ value: newValue });
    },

    get: (): T => {
      return reactor.state.value;
    },
  };

  return store;
}
