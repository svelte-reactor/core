/**
 * Example: Analytics Plugin
 *
 * Track state changes for analytics and monitoring.
 * Sends events to analytics services when state changes.
 */

import type { ReactorPlugin, PluginContext, Middleware } from '../../src/types/index.js';

export interface AnalyticsOptions {
  /** Analytics tracking function */
  track?: (event: string, properties: any) => void;

  /** Debounce tracking events (ms) */
  debounce?: number;

  /** Filter which actions to track */
  filter?: (action?: string) => boolean;
}

/**
 * Analytics plugin - tracks state changes
 *
 * @example
 * ```ts
 * const store = createReactor(state, {
 *   plugins: [
 *     analytics({
 *       track: (event, props) => {
 *         window.gtag?.('event', event, props);
 *       },
 *       debounce: 1000,
 *       filter: (action) => !action?.startsWith('temp:')
 *     })
 *   ]
 * });
 * ```
 */
export function analytics<T extends object>(
  options: AnalyticsOptions = {}
): ReactorPlugin<T> {
  const {
    track = (event, props) => console.log('[Analytics]', event, props),
    debounce = 0,
    filter = () => true,
  } = options;

  let debounceTimer: any;

  return {
    name: 'analytics',

    init(context: PluginContext<T>): void {
      const middleware: Middleware<T> = {
        name: 'analytics-middleware',

        onAfterUpdate(prevState: T, nextState: T, action?: string): void {
          // Skip if action is filtered out
          if (!filter(action)) return;

          // Clear existing timer
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          // Debounce tracking
          const trackNow = () => {
            const changes = findChanges(prevState, nextState);

            track('state_changed', {
              reactor: context.name,
              action,
              changes,
              timestamp: Date.now(),
            });
          };

          if (debounce > 0) {
            debounceTimer = setTimeout(trackNow, debounce);
          } else {
            // Call synchronously if no debounce
            trackNow();
          }
        },
      };

      context.middlewares.push(middleware);
    },

    destroy(): void {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    },
  };
}

/**
 * Helper function to find differences between states
 */
function findChanges(prev: any, next: any): Record<string, any> {
  const changes: Record<string, any> = {};

  for (const key in next) {
    if (prev[key] !== next[key]) {
      changes[key] = { from: prev[key], to: next[key] };
    }
  }

  return changes;
}
