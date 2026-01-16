/**
 * Example: Snapshot Plugin
 *
 * Automatically save state snapshots at intervals.
 * Useful for crash recovery and debugging.
 */

import type { ReactorPlugin, PluginContext, Middleware } from '../../src/types/index.js';
import { deepClone } from '../../src/utils/clone.js';

export interface SnapshotOptions {
  /** Snapshot interval in ms (default: 5000) */
  interval?: number;

  /** Maximum snapshots to keep (default: 10) */
  maxSnapshots?: number;

  /** Callback when snapshot is created */
  onSnapshot?: (snapshot: any, index: number) => void;
}

export interface Snapshot<T> {
  state: T;
  timestamp: number;
  index: number;
}

/**
 * Snapshot plugin - creates periodic state snapshots
 *
 * @example
 * ```ts
 * const editor = createReactor({ content: '' }, {
 *   plugins: [
 *     snapshot({
 *       interval: 30000, // Every 30 seconds
 *       maxSnapshots: 20,
 *       onSnapshot: (state) => {
 *         localStorage.setItem('backup', JSON.stringify(state));
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export function snapshot<T extends object>(
  options: SnapshotOptions = {}
): ReactorPlugin<T> {
  const { interval = 5000, maxSnapshots = 10, onSnapshot } = options;

  let snapshots: Snapshot<T>[] = [];
  let snapshotTimer: any;
  let updateCount = 0;
  let context: PluginContext<T> | null = null;

  function createSnapshot(): void {
    if (!context) return;

    const snapshot: Snapshot<T> = {
      state: deepClone(context.state),
      timestamp: Date.now(),
      index: updateCount,
    };

    snapshots.push(snapshot);

    // Keep only last N snapshots
    if (snapshots.length > maxSnapshots) {
      snapshots.shift();
    }

    onSnapshot?.(snapshot.state, snapshot.index);
  }

  return {
    name: 'snapshot',

    init(ctx: PluginContext<T>): void {
      context = ctx;

      // Create initial snapshot
      createSnapshot();

      // Start periodic snapshots
      snapshotTimer = setInterval(createSnapshot, interval);

      const middleware: Middleware<T> = {
        name: 'snapshot-middleware',

        onAfterUpdate(): void {
          updateCount++;
        },
      };

      ctx.middlewares.push(middleware);
    },

    destroy(): void {
      if (snapshotTimer) {
        clearInterval(snapshotTimer);
      }
      snapshots = [];
      context = null;
    },
  };
}

/**
 * Get all snapshots (for debugging/testing)
 */
export function getSnapshots<T>(): Snapshot<T>[] {
  // Note: In a real implementation, you'd want to store
  // snapshots in a global registry accessible from outside
  return [];
}
