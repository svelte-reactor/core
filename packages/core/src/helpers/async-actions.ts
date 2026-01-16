/**
 * Async Actions Helper - Handle async operations with automatic loading/error states
 *
 * @deprecated Use createQuery() (coming in v0.4.0) or plain async functions instead.
 * Will be removed in v0.4.0.
 * @see https://github.com/svelte-reactor/core/blob/master/UPGRADES/UPGRADE-0.3.0.md
 *
 * v0.2.9: Simplified API
 * - Removed retry logic (use at API layer with withRetry wrapper)
 * - Removed debounce (use external debounce like lodash/debounce)
 * - Simplified concurrency to 'queue' | 'replace' only
 */

import type { Reactor } from '../types/index.js';

// Track deprecation warning (show once per session)
let _asyncActionsDeprecationWarned = false;

export interface AsyncState {
  loading: boolean;
  error: Error | null;
}

export interface AsyncActionOptions {
  /**
   * Field name for loading state
   * @default 'loading'
   */
  loadingKey?: string;

  /**
   * Field name for error state
   * @default 'error'
   */
  errorKey?: string;

  /**
   * Action prefix for undo/redo history
   * @default 'async'
   */
  actionPrefix?: string;

  /**
   * Reset error on new request
   * @default true
   */
  resetErrorOnStart?: boolean;

  /**
   * How to handle concurrent requests for the same action
   * - 'replace': Cancel previous request, run new one (default)
   * - 'queue': Wait for previous to finish before starting new one
   * @default 'replace'
   */
  concurrency?: 'replace' | 'queue';

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error, actionName: string) => void;
}

export type AsyncAction<T, Args extends any[]> = (...args: Args) => Promise<T>;

export interface AsyncController<T> extends Promise<T> {
  /**
   * Cancel the async operation
   */
  cancel: () => void;

  /**
   * AbortController for the operation (if supported)
   */
  abort?: AbortController;
}

export type AsyncActions<T extends Record<string, AsyncAction<any, any>>> = {
  [K in keyof T]: T[K] extends AsyncAction<infer R, infer Args>
    ? (...args: Args) => AsyncController<R>
    : never;
};

/**
 * Create async actions helper for a reactor
 *
 * @example
 * ```typescript
 * const store = createReactor({
 *   users: [],
 *   loading: false,
 *   error: null
 * });
 *
 * const api = asyncActions(store, {
 *   fetchUsers: async () => {
 *     const response = await fetch('/api/users');
 *     return { users: await response.json() };
 *   },
 *   createUser: async (name: string) => {
 *     const response = await fetch('/api/users', {
 *       method: 'POST',
 *       body: JSON.stringify({ name })
 *     });
 *     return { users: [...store.state.users, await response.json()] };
 *   }
 * });
 *
 * // Usage - automatically handles loading & error states
 * await api.fetchUsers();
 * await api.createUser('John');
 * ```
 *
 * @example
 * ```typescript
 * // For retry logic, wrap at the API layer:
 * const fetchWithRetry = async () => {
 *   for (let i = 0; i < 3; i++) {
 *     try {
 *       return await fetch('/api/users').then(r => r.json());
 *     } catch (e) {
 *       if (i === 2) throw e;
 *       await new Promise(r => setTimeout(r, 1000 * (i + 1)));
 *     }
 *   }
 * };
 *
 * const api = asyncActions(store, { fetchUsers: fetchWithRetry });
 * ```
 */
export function asyncActions<
  S extends object,
  T extends Record<string, AsyncAction<any, any>>
>(
  reactor: Reactor<S>,
  actions: T,
  options: AsyncActionOptions = {}
): AsyncActions<T> {
  // Show deprecation warning (once per session)
  if (typeof console !== 'undefined' && !_asyncActionsDeprecationWarned) {
    _asyncActionsDeprecationWarned = true;
    console.warn(
      '[svelte-reactor] asyncActions() is deprecated.\n' +
      'Use createQuery() (coming in v0.4.0) or plain async functions instead.\n' +
      'See: https://github.com/svelte-reactor/core/blob/master/UPGRADES/UPGRADE-0.3.0.md'
    );
  }

  const {
    loadingKey = 'loading',
    errorKey = 'error',
    actionPrefix = 'async',
    resetErrorOnStart = true,
    concurrency = 'replace',
    onError,
  } = options;

  // Store abort controllers per action
  const abortControllers = new Map<string, AbortController>();

  // Track active requests per action for concurrency control
  const activeRequests = new Map<string, { id: number; promise: Promise<any> }>();
  const requestCounters = new Map<string, number>();

  // Track pending operations count for accurate loading state
  const pendingCounts = new Map<string, number>();

  const wrappedActions: any = {};

  for (const [name, action] of Object.entries(actions)) {
    wrappedActions[name] = (...args: any[]) => {
      let cancelled = false;
      let abortController: AbortController | undefined;

      // Generate unique request ID for this invocation
      const currentCounter = (requestCounters.get(name) ?? 0) + 1;
      requestCounters.set(name, currentCounter);
      const requestId = currentCounter;

      // Create abort controller if available
      if (typeof AbortController !== 'undefined') {
        abortController = new AbortController();
        abortControllers.set(name, abortController);
      }

      // For 'replace' mode, cancel previous request
      if (concurrency === 'replace') {
        const existing = activeRequests.get(name);
        if (existing) {
          const existingAbort = abortControllers.get(name);
          if (existingAbort) {
            existingAbort.abort();
          }
        }
      }

      // Helper to increment/decrement pending count
      const incrementPending = () => {
        pendingCounts.set(name, (pendingCounts.get(name) ?? 0) + 1);
      };
      const decrementPending = () => {
        const current = pendingCounts.get(name) ?? 1;
        pendingCounts.set(name, Math.max(0, current - 1));
      };
      const hasPendingRequests = () => (pendingCounts.get(name) ?? 0) > 0;

      const executeAction = async (): Promise<any> => {
        // For 'queue' mode, wait for previous request to complete
        if (concurrency === 'queue') {
          const existing = activeRequests.get(name);
          if (existing) {
            try {
              await existing.promise;
            } catch {
              // Ignore errors from previous request
            }
          }
        }

        if (cancelled) {
          throw new Error(
            `[asyncActions:${name}] Action cancelled.\n` +
            `  Action: ${name}\n` +
            `  Reason: cancel() was called before action started\n\n` +
            `Tip: Handle cancellation in your code:\n` +
            `  try { await actions.${name}(); }\n` +
            `  catch (error) { /* Handle cancellation */ }`
          );
        }

        incrementPending();

        // Set loading state and optionally reset error
        reactor.update((state) => {
          (state as any)[loadingKey] = true;
          if (resetErrorOnStart) {
            (state as any)[errorKey] = null;
          }
        }, `${actionPrefix}:${name}:start`);

        try {
          const result = await action(...args);

          // Check if this request is still the latest (race condition prevention)
          const latestRequestId = requestCounters.get(name) ?? 0;
          const isStale = concurrency === 'replace' && requestId !== latestRequestId;

          if (cancelled || isStale) {
            decrementPending();
            if (isStale) {
              // Silently ignore stale responses - don't update state
              return result;
            }
            throw new Error(
              `[asyncActions:${name}] Action cancelled.\n` +
              `  Action: ${name}\n` +
              `  Reason: cancel() was called during action execution\n\n` +
              `Tip: Check for cancellation in long-running operations:\n` +
              `  if (abortController.signal.aborted) return;`
            );
          }

          decrementPending();

          // Apply result to state and clear loading (only if no other pending requests)
          reactor.update((state) => {
            if (result && typeof result === 'object') {
              Object.assign(state, result);
            }
            // Only clear loading if no other pending requests for this action
            if (!hasPendingRequests()) {
              (state as any)[loadingKey] = false;
            }
            (state as any)[errorKey] = null;
          }, `${actionPrefix}:${name}:success`);

          return result;
        } catch (error) {
          decrementPending();

          // Check if this is a stale request
          const latestRequestId = requestCounters.get(name) ?? 0;
          const isStale = concurrency === 'replace' && requestId !== latestRequestId;

          if (cancelled || isStale) {
            // Don't update state if cancelled or stale
            throw error;
          }

          const err = error instanceof Error ? error : new Error(String(error));

          // Call onError callback if provided
          if (onError) {
            onError(err, name);
          }

          // Set error state and clear loading (only if no other pending requests)
          reactor.update((state) => {
            if (!hasPendingRequests()) {
              (state as any)[loadingKey] = false;
            }
            (state as any)[errorKey] = err;
          }, `${actionPrefix}:${name}:error`);

          throw error;
        }
      };

      // Execute action
      let promiseReject: ((reason?: any) => void) | null = null;
      const promise = new Promise<any>(async (resolve, reject) => {
        promiseReject = reject;
        try {
          const result = await executeAction();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          // Clean up active request tracking
          activeRequests.delete(name);
        }
      });

      // Track this request for queue mode
      activeRequests.set(name, { id: requestId, promise });

      // Create controller with cancel method
      const controller: any = promise;
      controller.cancel = () => {
        cancelled = true;

        // Reject the main promise if available
        if (promiseReject) {
          promiseReject(new Error('Action cancelled'));
        }

        // Abort if available
        if (abortController) {
          abortController.abort();
        }
      };
      controller.abort = abortController;

      return controller as AsyncController<any>;
    };
  }

  return wrappedActions as AsyncActions<T>;
}
