/**
 * Undo/Redo history manager
 */

import type { HistoryEntry, HistoryStack, UndoRedoHistory as IUndoRedoHistory } from '../types/index.js';
import { smartClone, isEqual } from '../utils/clone.js';

// Note: smartClone is 733x faster than deepClone (structuredClone) for typical use cases

/**
 * Undo/Redo history implementation
 */
export class UndoRedoHistory<T> implements IUndoRedoHistory<T> {
  private past: HistoryEntry<T>[] = [];
  private future: HistoryEntry<T>[] = [];
  private current: T;
  private limit: number;
  private batchMode = false;
  private batchBuffer: HistoryEntry<T>[] = [];
  private excludeActions: string[];
  private compress: boolean;
  private groupByAction: boolean;

  constructor(
    initialState: T,
    limit = 50,
    options?: {
      exclude?: string[];
      compress?: boolean;
      groupByAction?: boolean;
    }
  ) {
    this.current = smartClone(initialState);
    this.limit = limit;
    this.excludeActions = options?.exclude || [];
    this.compress = options?.compress || false;
    this.groupByAction = options?.groupByAction || false;
  }

  /**
   * Push new state to history
   */
  push(prevState: T, nextState: T, action?: string): void {
    // Skip excluded actions - but save prevState so undo returns to before excluded action
    if (action && this.excludeActions.includes(action)) {
      // Save prevState if this is first change after non-excluded action
      if (this.past.length === 0 || !isEqual(this.past[this.past.length - 1].state, prevState)) {
        this.past.push({
          state: smartClone(prevState),
          timestamp: Date.now(),
        });
        // Enforce limit
        if (this.past.length > this.limit) {
          this.past.shift();
        }
      }
      this.current = smartClone(nextState);
      this.future = [];
      return;
    }

    // If in batch mode, buffer the entry
    if (this.batchMode) {
      this.batchBuffer.push({
        state: smartClone(prevState),
        timestamp: Date.now(),
        action,
      });
      // Update current state even in batch mode
      this.current = smartClone(nextState);
      // Clear future (can't redo after new change)
      this.future = [];
      return;
    }

    // Group by action name if enabled
    if (this.groupByAction && action && this.past.length > 0) {
      const lastEntry = this.past[this.past.length - 1];
      if (lastEntry.action === action) {
        // Same action - just update current, don't add new entry
        this.current = smartClone(nextState);
        this.future = [];
        return;
      }
    }

    // Compress history if enabled
    if (this.compress) {
      // Simple compression: skip if next state is identical to current
      if (isEqual(this.current, nextState)) {
        // State hasn't changed, skip
        return;
      }
    }

    // Add to history
    this.past.push({
      state: smartClone(prevState),
      timestamp: Date.now(),
      action,
    });

    // Enforce limit
    if (this.past.length > this.limit) {
      this.past.shift();
    }

    // Clear future (can't redo after new change)
    this.future = [];

    // Update current
    this.current = smartClone(nextState);
  }

  /**
   * Undo last change
   */
  undo(): T | null {
    if (this.past.length === 0) {
      return null;
    }

    const entry = this.past.pop()!;

    // Save current to future
    this.future.push({
      state: smartClone(this.current),
      timestamp: Date.now(),
    });

    // Restore previous state
    this.current = smartClone(entry.state);
    return entry.state;
  }

  /**
   * Redo last undone change
   */
  redo(): T | null {
    if (this.future.length === 0) {
      return null;
    }

    const entry = this.future.pop()!;

    // Save current to past
    this.past.push({
      state: smartClone(this.current),
      timestamp: Date.now(),
    });

    // Restore future state
    this.current = smartClone(entry.state);
    return entry.state;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Start batch mode (group multiple changes)
   */
  startBatch(): void {
    this.batchMode = true;
    this.batchBuffer = [];
  }

  /**
   * End batch mode and save as single entry
   */
  endBatch(): void {
    this.batchMode = false;

    if (this.batchBuffer.length > 0) {
      // Save only the first state (before batch) to past
      const firstEntry = this.batchBuffer[0];
      this.past.push({
        state: firstEntry.state,
        timestamp: Date.now(),
        action: 'batch',
      });

      // Note: this.current already contains the final state after all batch updates
      // because each push() call in batch mode updated this.current

      // Enforce limit
      if (this.past.length > this.limit) {
        this.past.shift();
      }

      // Clear buffer
      this.batchBuffer = [];
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Get history stack for inspection
   */
  getStack(): HistoryStack<T> {
    return {
      past: [...this.past],
      future: [...this.future],
      current: smartClone(this.current),
    };
  }
}
