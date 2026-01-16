/**
 * Logger middleware for debugging
 */

import type { Middleware, LoggerOptions } from '../types/index.js';

/**
 * Helper to limit object depth for logging
 */
function limitDepth(obj: any, maxDepth: number, currentDepth = 0): any {
  if (currentDepth >= maxDepth) {
    return typeof obj === 'object' && obj !== null ? '{...}' : obj;
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => limitDepth(item, maxDepth, currentDepth + 1));
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = limitDepth(obj[key], maxDepth, currentDepth + 1);
    }
  }
  return result;
}

/**
 * Create logger middleware
 */
export function createLoggerMiddleware<T extends object>(
  options?: LoggerOptions
): Middleware<T> {
  const {
    collapsed = false,
    filter,
    performance: perfOption,
    trackPerformance, // deprecated
    slowThreshold,
    includeTimestamp = false,
    maxDepth = 3,
  } = options ?? {};

  // Support both new 'performance' and deprecated 'trackPerformance'
  const enablePerformance = perfOption ?? trackPerformance ?? false;

  // Track timing if performance tracking is enabled
  const timings = new Map<string, number>();

  return {
    name: 'logger',

    onBeforeUpdate(prevState, nextState, action) {
      if (enablePerformance && action) {
        timings.set(action, performance.now());
      }
    },

    onAfterUpdate(prevState, nextState, action) {
      // Filter actions if provided
      if (filter && !filter(action, nextState, prevState)) {
        return;
      }

      const groupMethod = collapsed ? 'groupCollapsed' : 'group';
      const actionName = action || 'update';

      // Calculate performance timing
      let duration: number | null = null;
      let isSlowAction = false;

      if (enablePerformance && action) {
        const startTime = timings.get(action);
        if (startTime !== undefined) {
          duration = performance.now() - startTime;
          timings.delete(action);

          if (slowThreshold && duration > slowThreshold) {
            isSlowAction = true;
          }
        }
      }

      // Build title with optional timestamp and duration
      let title = `Reactor ${actionName}`;
      if (includeTimestamp) {
        const timestamp = new Date().toLocaleTimeString();
        title = `[${timestamp}] ${title}`;
      }
      if (duration !== null) {
        title = `${title} (${duration.toFixed(2)}ms)`;
      }

      // Choose color based on performance
      let color = '#10b981'; // green
      if (isSlowAction) {
        color = '#F59E0B'; // orange/warning
      }

      console[groupMethod](
        `%c ${title}`,
        `color: ${color}; font-weight: bold; font-size: 11px;`
      );

      // Warn about slow actions
      if (isSlowAction && duration !== null) {
        console.warn(
          `⚠️ Slow action detected: ${duration.toFixed(2)}ms (threshold: ${slowThreshold}ms)`
        );
      }

      // Log states with depth limiting
      const prevStateToLog = maxDepth > 0 ? limitDepth(prevState, maxDepth) : prevState;
      const nextStateToLog = maxDepth > 0 ? limitDepth(nextState, maxDepth) : nextState;

      console.log(
        '%c prev state',
        'color: #9CA3AF; font-weight: bold;',
        prevStateToLog
      );

      console.log(
        '%c next state',
        'color: #3B82F6; font-weight: bold;',
        nextStateToLog
      );

      console.groupEnd();
    },

    onError(error) {
      console.error(
        '%c Reactor Error',
        'color: #EF4444; font-weight: bold;',
        error
      );
    },
  };
}
