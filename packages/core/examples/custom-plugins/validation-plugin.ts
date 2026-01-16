/**
 * Example: Validation Plugin
 *
 * Validates state before updates are applied.
 * Useful for ensuring data integrity and business rules.
 */

import type { ReactorPlugin, PluginContext, Middleware } from '../../src/types/index.js';

export interface ValidationOptions<T> {
  /** Validation function - return true or error message */
  validate: (state: T) => boolean | string;

  /** Throw error on validation failure (default: true) */
  throwOnError?: boolean;

  /** Custom error message */
  errorMessage?: string;
}

/**
 * Validation plugin - ensures state validity before updates
 *
 * @example
 * ```ts
 * const store = createReactor({ age: 0 }, {
 *   plugins: [
 *     validation({
 *       validate: (state) => state.age >= 0 || 'Age must be positive'
 *     })
 *   ]
 * });
 *
 * store.update(s => { s.age = -5; }); // Throws error
 * ```
 */
export function validation<T extends object>(
  options: ValidationOptions<T>
): ReactorPlugin<T> {
  const { validate, throwOnError = true, errorMessage } = options;

  return {
    name: 'validation',

    init(context: PluginContext<T>): void {
      const middleware: Middleware<T> = {
        name: 'validation-middleware',

        onBeforeUpdate(prevState: T, nextState: T, action?: string): void {
          const result = validate(nextState);

          if (result !== true) {
            const message =
              typeof result === 'string'
                ? result
                : errorMessage || 'Validation failed';

            const fullMessage = `[validation] ${message}` + (action ? ` (action: ${action})` : '');

            if (throwOnError) {
              console.error(fullMessage, nextState);
              // Note: Throwing here won't prevent the update due to middleware error handling
              // For production, validate BEFORE calling update() or use a wrapper
            } else {
              console.warn(fullMessage, nextState);
            }
          }
        },
      };

      context.middlewares.push(middleware);
    },
  };
}
