/**
 * Middleware system for reactor
 */

import type { Middleware } from '../types/index.js';

/**
 * Create middleware chain executor
 */
export function createMiddlewareChain<T extends object>(middlewares: Middleware<T>[]) {
  return {
    /**
     * Run before update hooks
     */
    runBefore(prevState: T, nextState: T, action?: string): void {
      // Fast path: skip if no middlewares
      if (middlewares.length === 0) return;

      for (const middleware of middlewares) {
        try {
          middleware.onBeforeUpdate?.(prevState, nextState, action);
        } catch (error) {
          middleware.onError?.(error as Error);
        }
      }
    },

    /**
     * Run after update hooks
     */
    runAfter(prevState: T, nextState: T, action?: string): void {
      // Fast path: skip if no middlewares
      if (middlewares.length === 0) return;

      for (const middleware of middlewares) {
        try {
          middleware.onAfterUpdate?.(prevState, nextState, action);
        } catch (error) {
          middleware.onError?.(error as Error);
        }
      }
    },

    /**
     * Handle error
     */
    handleError(error: Error): void {
      // Fast path: skip if no middlewares
      if (middlewares.length === 0) return;

      for (const middleware of middlewares) {
        middleware.onError?.(error);
      }
    },
  };
}
