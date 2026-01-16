/**
 * Logger plugin for debugging
 */

import type { ReactorPlugin, LoggerOptions } from '../types/index.js';
import { createLoggerMiddleware } from '../middleware/logger.js';

/**
 * Enable logging of all state changes
 *
 * @example
 * ```ts
 * const reactor = createReactor(state, {
 *   plugins: [logger({ collapsed: true })],
 * });
 * ```
 */
export function logger<T extends object>(options?: LoggerOptions): ReactorPlugin<T> {
  return {
    name: 'logger',

    init(context) {
      // Add logger middleware
      const loggerMiddleware = createLoggerMiddleware<T>(options);
      context.middlewares.push(loggerMiddleware);
    },

    destroy() {
      // Cleanup handled by reactor
    },
  };
}
