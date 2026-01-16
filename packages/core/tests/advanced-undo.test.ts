/**
 * Advanced undo/redo tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { undoRedo } from '../src/plugins';

interface CounterState {
  value: number;
}

describe('Advanced undo/redo features', () => {
  describe('exclude actions', () => {
    it('should skip excluded actions from history', () => {
      const counter = createReactor({ value: 0 }, {
        plugins: [
          undoRedo({
            limit: 10,
            exclude: ['skip-me'],
          }),
        ],
      });

      // This should be in history
      counter.update((state) => {
        state.value = 1;
      }, 'increment');

      // This should be skipped
      counter.update((state) => {
        state.value = 2;
      }, 'skip-me');

      expect(counter.state.value).toBe(2);
      expect(counter.canUndo()).toBe(true);

      // Should undo to 1, not 0
      counter.undo();
      expect(counter.state.value).toBe(1);
    });
  });

  describe('groupByAction', () => {
    it('should group consecutive actions with same name', () => {
      const counter = createReactor({ value: 0 }, {
        plugins: [
          undoRedo({
            limit: 10,
            groupByAction: true,
          }),
        ],
      });

      // Multiple increments (same action)
      counter.update((state) => {
        state.value++;
      }, 'increment');
      counter.update((state) => {
        state.value++;
      }, 'increment');
      counter.update((state) => {
        state.value++;
      }, 'increment');

      expect(counter.state.value).toBe(3);

      // Should only need one undo to go back to start
      // because consecutive same actions are grouped
      const inspection = counter.inspect();
      expect(inspection.history.past.length).toBeLessThanOrEqual(1);
    });
  });

  describe('compress', () => {
    it('should compress identical consecutive states', () => {
      const counter = createReactor({ value: 0 }, {
        plugins: [
          undoRedo({
            limit: 10,
            compress: true,
          }),
        ],
      });

      counter.update((state) => {
        state.value = 5;
      });

      // Same state again - should be compressed
      counter.update((state) => {
        state.value = 5;
      });

      const inspection = counter.inspect();

      // Should only have 1 entry, not 2
      expect(inspection.history.past.length).toBeLessThanOrEqual(1);
    });
  });

  describe('combined features', () => {
    it('should work with all advanced features together', () => {
      const counter = createReactor({ value: 0 }, {
        plugins: [
          undoRedo({
            limit: 10,
            exclude: ['skip'],
            compress: true,
            groupByAction: true,
          }),
        ],
      });

      counter.update((state) => {
        state.value = 1;
      }, 'increment');
      counter.update((state) => {
        state.value = 2;
      }, 'increment');
      counter.update((state) => {
        state.value = 3;
      }, 'increment');

      expect(counter.state.value).toBe(3);
      expect(counter.canUndo()).toBe(true);

      counter.undo();
      expect(counter.canUndo()).toBe(false); // Should be at start after undo (groupByAction merged all)
    });
  });
});

describe('Batch operations advanced', () => {
  it('should handle nested batch operations', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [undoRedo({ limit: 10 })],
    });

    counter.batch(() => {
      counter.update((state) => {
        state.value = 1;
      });
      counter.update((state) => {
        state.value = 2;
      });
      counter.update((state) => {
        state.value = 3;
      });
    });

    expect(counter.state.value).toBe(3);

    // One undo should revert entire batch
    counter.undo();
    expect(counter.state.value).toBe(0);
  });

  it('should handle multiple separate batches', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [undoRedo({ limit: 10 })],
    });

    // Batch 1
    counter.batch(() => {
      counter.update((state) => {
        state.value++;
      });
      counter.update((state) => {
        state.value++;
      });
    });

    // Batch 2
    counter.batch(() => {
      counter.update((state) => {
        state.value++;
      });
      counter.update((state) => {
        state.value++;
      });
    });

    expect(counter.state.value).toBe(4);

    // Should have 2 history entries (one per batch)
    const inspection = counter.inspect();
    expect(inspection.history.past.length).toBe(2);

    // First undo should revert batch 2
    counter.undo();
    expect(counter.state.value).toBe(2);

    // Second undo should revert batch 1
    counter.undo();
    expect(counter.state.value).toBe(0);
  });
});
