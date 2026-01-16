/**
 * Computed Store - Memoized derived state with dependency tracking
 *
 * @example
 * ```typescript
 * const store = createReactor({ items: [], filter: 'all' });
 *
 * const filteredItems = computedStore(
 *   store,
 *   state => state.items.filter(item => {
 *     if (state.filter === 'completed') return item.done;
 *     if (state.filter === 'active') return !item.done;
 *     return true;
 *   }),
 *   {
 *     keys: ['items', 'filter'],  // Only recompute when these change
 *     equals: isEqual  // Deep equality check
 *   }
 * );
 * ```
 */

import { derived, type Readable } from 'svelte/store';
import type { Reactor } from '../types/index.js';
import { isEqual } from '../utils/clone.js';

export interface ComputedStoreOptions<R> {
  /**
   * Dependency keys - only recompute when these fields change.
   * If omitted, recomputes on any state change.
   */
  keys?: string[];

  /**
   * Custom equality function for result comparison.
   * Prevents updates if new result equals previous result.
   * Default: `(a, b) => a === b`
   */
  equals?: (a: R, b: R) => boolean;
}

/**
 * Create a memoized computed store from a reactor.
 *
 * Features:
 * - Prevents unnecessary recomputations
 * - Stable references (prevents re-renders)
 * - Fine-grained dependency tracking via `keys` option
 * - Custom equality checking via `equals` option
 *
 * @param source - Source reactor to derive from
 * @param compute - Computation function
 * @param options - Optional configuration (keys, equals)
 * @returns Readable store with computed value
 */
export function computedStore<T extends object, R>(
  source: Reactor<T>,
  compute: (state: T) => R,
  options?: ComputedStoreOptions<R>
): Readable<R> {
  let cache: R | undefined;
  let prevKeys: any[] | undefined;
  let initialized = false;

  // Helper function to compute value
  const computeValue = (state: T): R => {
    // Check if dependencies changed (if keys specified)
    if (options?.keys && initialized) {
      const currentKeys = options.keys.map(key => getNestedValue(state, key));

      // Use deep equality for key comparison (handles smartClone creating new objects)
      if (prevKeys && isEqual(prevKeys, currentKeys)) {
        // Dependencies haven't changed, return cached value
        return cache!;
      }

      prevKeys = currentKeys;
    } else if (options?.keys) {
      // First run with keys - initialize prevKeys
      prevKeys = options.keys.map(key => getNestedValue(state, key));
    }

    // Recompute
    const result = compute(state);

    // Check if result changed (using equality function)
    const equals = options?.equals ?? ((a, b) => a === b);

    if (initialized && cache !== undefined && equals(cache, result)) {
      // Result hasn't changed, return old reference
      return cache;
    }

    // Update cache
    cache = result;
    initialized = true;

    return result;
  };

  // Custom readable store implementation with fine-grained control
  const store: Readable<R> = {
    subscribe(subscriber: (value: R) => void) {
      let previousValue: R | undefined;

      // Subscribe to source and handle updates manually
      const unsubscribe = source.subscribe((state) => {
        const result = computeValue(state);

        // Only notify if value actually changed
        if (previousValue === undefined || result !== previousValue) {
          previousValue = result;
          subscriber(result);
        }
      });

      return unsubscribe;
    }
  };

  return store;
}

/**
 * Helper to get nested value from object using dot notation
 * @example getNestedValue({ user: { name: 'John' } }, 'user.name') // 'John'
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Compare two arrays for shallow equality
 */
function arraysEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
