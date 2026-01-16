/**
 * Core reactor implementation with Svelte 5 Runes
 */

import { untrack } from 'svelte';
import type {
  Reactor,
  ReactorOptions,
  ReactorInspection,
  PluginContext,
  Middleware,
} from '../types/index.js';
import { UndoRedoHistory } from '../history/undo-redo.js';
import { createMiddlewareChain } from '../middleware/middleware.js';
import { deepClone, smartClone, isEqual } from '../utils/clone.js';

/**
 * Create a reactor with undo/redo, middleware, and plugin support
 *
 * @example
 * ```ts
 * const counter = createReactor({ value: 0 }, {
 *   plugins: [undoRedo(), logger()],
 * });
 *
 * counter.update(state => { state.value++; });
 * counter.undo();
 * ```
 */
export function createReactor<T extends object>(
  initialState: T,
  options?: ReactorOptions<T>
): Reactor<T> {
  // Validate initial state
  if (!initialState || typeof initialState !== 'object') {
    throw new TypeError('[Reactor] initialState must be a non-null object');
  }

  const { plugins = [], name = 'reactor', devtools = false, onChange } = options ?? {};

  // Validate reactor name
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('[Reactor] name must be a non-empty string');
  }

  // Create reactive state with Svelte 5 $state
  let state = $state(initialState) as T;

  // Middleware array
  const middlewares: Middleware<T>[] = [];

  // History (will be set by undo/redo plugin if enabled)
  let history: UndoRedoHistory<T> | undefined;

  // Track history changes for reactivity
  let historyVersion = $state(0);

  // Track if reactor is destroyed
  let destroyed = false;

  // Subscribers for Svelte stores compatibility
  const subscribers = new Set<(value: T) => void>();

  // Batching state
  let batchDepth = 0;
  let batchStartState: T | undefined;
  let batchEndState: T | undefined;

  // Plugin context
  const pluginContext: PluginContext<T> = {
    state,
    history,
    middlewares,
    name,
  };

  // Initialize plugins
  for (const plugin of plugins) {
    try {
      plugin.init(pluginContext);

      // Update history reference if plugin added it
      if (pluginContext.history) {
        history = pluginContext.history as UndoRedoHistory<T>;
      }
    } catch (error) {
      console.error(`[Reactor] Failed to initialize plugin "${plugin.name}":`, error);
    }
  }

  // Create middleware chain
  const middlewareChain = createMiddlewareChain(middlewares);

  /**
   * Notify all subscribers about state change
   */
  function notifySubscribers(nextState: T, prevState: T, action?: string): void {
    // Clone states once and reuse (performance optimization)
    const nextClone = smartClone(nextState);
    const prevClone = onChange ? smartClone(prevState) : undefined;

    // Call subscribers
    subscribers.forEach((subscriber) => {
      try {
        subscriber(nextClone);
      } catch (error) {
        console.error('[Reactor] Subscriber error:', error);
      }
    });

    // Call onChange callback if provided
    if (onChange && prevClone !== undefined) {
      try {
        onChange(nextClone, prevClone, action);
      } catch (error) {
        console.error('[Reactor] onChange callback error:', error);
      }
    }
  }

  /**
   * Subscribe to state changes (Svelte stores API compatible)
   *
   * NOTE: For selective subscriptions, use select() instead.
   *
   * @param subscriber Callback that receives the entire state
   * @param invalidate Optional invalidate function (Svelte stores compatibility)
   */
  function subscribe(
    subscriber: (value: T) => void,
    invalidate?: () => void
  ): () => void {
    if (typeof subscriber !== 'function') {
      throw new TypeError(`[Reactor:${name}] subscribe() requires a function, got ${typeof subscriber}`);
    }

    if (destroyed) {
      console.warn(`[Reactor:${name}] Cannot subscribe to destroyed reactor. Call destroy() cleanup.`);
      return () => {};
    }

    // Add subscriber
    subscribers.add(subscriber);

    // Immediately call with current state (Svelte stores behavior)
    try {
      subscriber(smartClone(state));
    } catch (error) {
      console.error(`[Reactor:${name}] Subscriber error on initial call:`, error);
    }

    // Return unsubscribe function
    return () => {
      subscribers.delete(subscriber);
    };
  }

  /**
   * Update state using an updater function
   */
  function update(updater: (state: T) => void, action?: string): void {
    if (typeof updater !== 'function') {
      throw new TypeError(`[Reactor:${name}] update() requires a function, got ${typeof updater}`);
    }

    if (destroyed) {
      console.warn(`[Reactor:${name}] Cannot update destroyed reactor. Reactor was destroyed at ${new Date().toISOString()}`);
      return;
    }

    try {
      // Capture previous state (use smartClone for performance)
      const prevState = smartClone(state);

      // Apply update to real state
      updater(state);

      // Capture next state after update (use smartClone for performance)
      const nextState = smartClone(state);

      // Skip update if state hasn't actually changed (performance optimization)
      if (isEqual(prevState, nextState)) {
        return;
      }

      // Run before middlewares
      middlewareChain.runBefore(prevState, nextState, action);

      // Push to history
      if (history) {
        history.push(prevState, nextState, action);
        historyVersion++;
      }

      // Run after middlewares
      middlewareChain.runAfter(prevState, nextState, action);

      // Handle batching
      if (batchDepth > 0) {
        // We're in a batch, store states for later notification
        if (!batchStartState) {
          batchStartState = prevState;
        }
        batchEndState = nextState;
      } else {
        // Not in a batch, notify immediately
        notifySubscribers(nextState, prevState, action);
      }
    } catch (error) {
      const actionName = action ? ` (action: "${action}")` : '';
      console.error(`[Reactor:${name}] Update failed${actionName}:`, error);
      middlewareChain.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Set state directly
   */
  function set(newState: Partial<T>): void {
    update((state) => {
      Object.assign(state, newState);
    });
  }

  /**
   * Undo last change
   */
  function undo(): void {
    if (!history) {
      console.warn('[Reactor] Undo/redo not enabled. Add undoRedo plugin.');
      return;
    }

    const currentState = deepClone(state);
    const prevState = history.undo();
    if (prevState) {
      historyVersion++;
      // Update each property individually to trigger reactivity
      for (const key in prevState) {
        if (Object.prototype.hasOwnProperty.call(prevState, key)) {
          (state as any)[key] = (prevState as any)[key];
        }
      }
      // Notify subscribers about the undo
      notifySubscribers(prevState, currentState, 'undo');
    }
  }

  /**
   * Redo last undone change
   */
  function redo(): void {
    if (!history) {
      console.warn('[Reactor] Undo/redo not enabled. Add undoRedo plugin.');
      return;
    }

    const currentState = deepClone(state);
    const nextState = history.redo();
    if (nextState) {
      historyVersion++;
      // Update each property individually to trigger reactivity
      for (const key in nextState) {
        if (Object.prototype.hasOwnProperty.call(nextState, key)) {
          (state as any)[key] = (nextState as any)[key];
        }
      }
      // Notify subscribers about the redo
      notifySubscribers(nextState, currentState, 'redo');
    }
  }

  /**
   * Check if undo is available
   */
  function canUndo(): boolean {
    // Access historyVersion to make this reactive
    historyVersion;
    return history?.canUndo() ?? false;
  }

  /**
   * Check if redo is available
   */
  function canRedo(): boolean {
    // Access historyVersion to make this reactive
    historyVersion;
    return history?.canRedo() ?? false;
  }

  /**
   * Batch multiple updates into single history entry and notification
   */
  function batch(fn: () => void): void {
    // Start batching
    batchDepth++;

    // Start history batch if available
    if (history) {
      history.startBatch();
    }

    try {
      fn();
    } finally {
      // End history batch if available
      if (history) {
        history.endBatch();
      }

      // End batching
      batchDepth--;

      // If this is the outermost batch and we have accumulated changes, notify once
      if (batchDepth === 0 && batchStartState && batchEndState) {
        notifySubscribers(batchEndState, batchStartState, 'batch');
        batchStartState = undefined;
        batchEndState = undefined;
      }
    }
  }

  /**
   * Clear all history
   */
  function clearHistory(): void {
    if (!history) {
      console.warn('[Reactor] Undo/redo not enabled. Add undoRedo plugin.');
      return;
    }
    history.clear();
  }

  /**
   * Get history entries
   */
  function getHistory(): any[] {
    if (!history) {
      console.warn('[Reactor] Undo/redo not enabled. Add undoRedo plugin.');
      return [];
    }
    const stack = history.getStack();
    return stack.past;
  }

  /**
   * Get reactor inspection data (for DevTools)
   */
  function inspect(): ReactorInspection<T> {
    return {
      name,
      state: smartClone(state),
      history: history?.getStack() ?? { past: [], future: [], current: state },
      middlewares: middlewares.map((m) => m.name),
      plugins: plugins.map((p) => p.name),
    };
  }

  /**
   * Cleanup and destroy reactor
   */
  function destroy(): void {
    if (destroyed) return;

    destroyed = true;

    // Cleanup plugins
    for (const plugin of plugins) {
      try {
        plugin.destroy?.();
      } catch (error) {
        console.error(`[Reactor] Failed to destroy plugin "${plugin.name}":`, error);
      }
    }

    // Clear subscribers to prevent memory leaks
    subscribers.clear();

    // Clear middlewares
    middlewares.length = 0;

    // Clear history
    history?.clear();
  }

  /**
   * Selective subscribe to specific part of state
   *
   * Use this instead of subscribe() when you only need to react to changes
   * in a specific field or derived value.
   *
   * @example
   * ```ts
   * store.select(
   *   state => state.user.name,
   *   (name, prevName) => console.log(`Name changed: ${prevName} -> ${name}`)
   * );
   * ```
   */
  function select<R>(
    selector: (state: T) => R,
    onChanged: (value: R, prevValue?: R) => void,
    options?: {
      fireImmediately?: boolean;
      equalityFn?: (a: R, b: R) => boolean;
    }
  ): () => void {
    const { fireImmediately = true, equalityFn = (a: R, b: R) => a === b } = options ?? {};

    if (typeof selector !== 'function') {
      throw new TypeError(`[Reactor:${name}] select() selector must be a function, got ${typeof selector}`);
    }

    if (typeof onChanged !== 'function') {
      throw new TypeError(`[Reactor:${name}] select() onChanged must be a function, got ${typeof onChanged}`);
    }

    if (destroyed) {
      console.warn(`[Reactor:${name}] Cannot subscribe to destroyed reactor. Call destroy() cleanup.`);
      return () => {};
    }

    let prevValue: R | undefined;
    let initialized = false;

    // Create wrapper subscriber that handles selective logic
    const selectiveSubscriber = (fullState: T) => {
      const nextValue = selector(fullState);

      // Initialize on first call
      if (!initialized) {
        prevValue = nextValue;
        initialized = true;

        // Fire immediately if requested
        if (fireImmediately) {
          onChanged(nextValue, undefined);
        }
        return;
      }

      // Skip if value hasn't changed
      if (prevValue !== undefined && equalityFn(prevValue, nextValue)) {
        return;
      }

      // Call callback with new value and previous value
      const oldValue = prevValue;
      prevValue = nextValue;
      onChanged(nextValue, oldValue);
    };

    // Add subscriber
    subscribers.add(selectiveSubscriber);

    // Immediately call with current state to initialize
    try {
      selectiveSubscriber(smartClone(state));
    } catch (error) {
      console.error(`[Reactor:${name}] Selective subscriber error on initial call:`, error);
    }

    // Return unsubscribe function
    return () => {
      subscribers.delete(selectiveSubscriber);
    };
  }

  // Return reactor instance
  return {
    get state() {
      return state;
    },
    subscribe,
    select,
    update,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    batch,
    clearHistory,
    getHistory,
    inspect,
    destroy,
  };
}
