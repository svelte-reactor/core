/**
 * Simple store helper - wraps createReactor for simple use cases
 */

import { createReactor } from '../core/reactor.svelte.js';
import type { ReactorOptions, Subscriber, Unsubscriber } from '../types/index.js';
import { createValueStoreFromReactor } from './value-store-factory.js';

/**
 * Svelte-compatible writable store interface
 */
export interface WritableStore<T> {
  /** Subscribe to value changes */
  subscribe(subscriber: Subscriber<T>): Unsubscriber;

  /** Set new value */
  set(value: T): void;

  /** Update value using updater function */
  update(updater: (value: T) => T): void;

  /** Get current value */
  get(): T;
}

/**
 * Create a simple store that wraps a single value
 * Compatible with Svelte stores API
 *
 * @example
 * ```ts
 * const counter = simpleStore(0);
 *
 * counter.subscribe(value => console.log(value)); // 0
 * counter.update(n => n + 1);
 * console.log(counter.get()); // 1
 * ```
 */
export function simpleStore<T>(
  initialValue: T,
  options?: Omit<ReactorOptions<{ value: T }>, 'plugins'>
): WritableStore<T> {
  const reactor = createReactor({ value: initialValue }, options);
  return createValueStoreFromReactor(reactor);
}
