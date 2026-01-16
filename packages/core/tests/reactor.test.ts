/**
 * Core reactor tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { undoRedo, logger } from '../src/plugins';

interface CounterState {
  value: number;
}

describe('createReactor', () => {
  let counter: ReturnType<typeof createReactor<CounterState>>;

  beforeEach(() => {
    counter = createReactor({ value: 0 });
  });

  it('should create a reactor with initial state', () => {
    expect(counter.state.value).toBe(0);
  });

  it('should update state using update()', () => {
    counter.update((state) => {
      state.value = 5;
    });

    expect(counter.state.value).toBe(5);
  });

  it('should update state using set()', () => {
    counter.set({ value: 10 });

    expect(counter.state.value).toBe(10);
  });

  it('should handle multiple updates', () => {
    counter.update((state) => {
      state.value++;
    });
    counter.update((state) => {
      state.value++;
    });
    counter.update((state) => {
      state.value++;
    });

    expect(counter.state.value).toBe(3);
  });

  it('should provide inspect() method', () => {
    const inspection = counter.inspect();

    expect(inspection).toHaveProperty('name');
    expect(inspection).toHaveProperty('state');
    expect(inspection).toHaveProperty('history');
    expect(inspection).toHaveProperty('middlewares');
    expect(inspection).toHaveProperty('plugins');
  });

  it('should cleanup on destroy()', () => {
    counter.destroy();

    // After destroy, updates should be ignored
    const prevValue = counter.state.value;
    counter.update((state) => {
      state.value = 999;
    });

    // Value should not change after destroy
    expect(counter.state.value).toBe(prevValue);
  });
});

describe('reactor with undo/redo plugin', () => {
  let counter: ReturnType<typeof createReactor<CounterState>>;

  beforeEach(() => {
    counter = createReactor({ value: 0 }, {
      plugins: [undoRedo({ limit: 10 })],
    });
  });

  it('should undo changes', () => {
    counter.update((state) => {
      state.value = 5;
    });

    expect(counter.state.value).toBe(5);

    counter.undo();

    expect(counter.state.value).toBe(0);
  });

  it('should redo changes', () => {
    counter.update((state) => {
      state.value = 5;
    });
    counter.undo();
    counter.redo();

    expect(counter.state.value).toBe(5);
  });

  it('should check canUndo() and canRedo()', () => {
    expect(counter.canUndo()).toBe(false);
    expect(counter.canRedo()).toBe(false);

    counter.update((state) => {
      state.value = 5;
    });

    expect(counter.canUndo()).toBe(true);
    expect(counter.canRedo()).toBe(false);

    counter.undo();

    expect(counter.canUndo()).toBe(false);
    expect(counter.canRedo()).toBe(true);
  });

  it('should handle batch operations', () => {
    counter.batch(() => {
      counter.update((state) => {
        state.value++;
      });
      counter.update((state) => {
        state.value++;
      });
      counter.update((state) => {
        state.value++;
      });
    });

    expect(counter.state.value).toBe(3);

    // Should undo all 3 changes in one step
    counter.undo();

    expect(counter.state.value).toBe(0);
  });
});

describe('reactor with logger plugin', () => {
  it('should initialize with logger plugin', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [logger({ collapsed: true })],
    });

    expect(counter).toBeDefined();

    const inspection = counter.inspect();
    expect(inspection.plugins).toContain('logger');
    expect(inspection.middlewares).toContain('logger');
  });
});

describe('reactor with multiple plugins', () => {
  it('should work with both undo and logger plugins', () => {
    const counter = createReactor({ value: 0 }, {
      plugins: [
        undoRedo({ limit: 10 }),
        logger({ collapsed: true }),
      ],
    });

    counter.update((state) => {
      state.value = 5;
    });

    expect(counter.state.value).toBe(5);
    expect(counter.canUndo()).toBe(true);

    counter.undo();

    expect(counter.state.value).toBe(0);
  });
});

describe('Bug Fixes (v0.2.2)', () => {
  describe('Memory Leaks', () => {
    it('should clear subscribers on destroy()', () => {
      const counter = createReactor({ value: 0 });

      let callCount = 0;
      const unsubscribe = counter.subscribe(() => {
        callCount++;
      });

      expect(callCount).toBe(1); // Initial call

      counter.update((state) => { state.value++; });
      expect(callCount).toBe(2);

      // Destroy reactor
      counter.destroy();

      // Try to update - should not call subscriber
      counter.update((state) => { state.value++; });
      expect(callCount).toBe(2); // Still 2, not 3
    });

    it('should clear middlewares on destroy()', () => {
      const counter = createReactor({ value: 0 }, {
        plugins: [logger({ collapsed: true })],
      });

      const inspection1 = counter.inspect();
      expect(inspection1.middlewares.length).toBeGreaterThan(0);

      counter.destroy();

      const inspection2 = counter.inspect();
      expect(inspection2.middlewares.length).toBe(0);
    });
  });

  describe('Shallow Comparison Optimization', () => {
    it('should skip update if state unchanged', () => {
      const counter = createReactor({ value: 5 });

      let updateCount = 0;
      counter.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial call

      // Update with no actual change
      counter.update((state) => {
        // Do nothing
      });

      expect(updateCount).toBe(1); // Still 1, not 2
      expect(counter.state.value).toBe(5);
    });

    it('should skip update if value set to same', () => {
      const counter = createReactor({ value: 5 });

      let updateCount = 0;
      counter.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial call

      // Update to same value
      counter.update((state) => {
        state.value = 5; // Same as before
      });

      expect(updateCount).toBe(1); // Still 1, not 2
    });

    it('should trigger update if value actually changes', () => {
      const counter = createReactor({ value: 5 });

      let updateCount = 0;
      counter.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial call

      // Update to different value
      counter.update((state) => {
        state.value = 10;
      });

      expect(updateCount).toBe(2); // Now 2
      expect(counter.state.value).toBe(10);
    });
  });

  describe('Error Handling & Validation', () => {
    it('should throw on invalid initialState', () => {
      expect(() => {
        // @ts-expect-error - testing invalid input
        createReactor(null);
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error - testing invalid input
        createReactor(undefined);
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error - testing invalid input
        createReactor('not an object');
      }).toThrow(TypeError);
    });

    it('should throw on invalid reactor name', () => {
      expect(() => {
        createReactor({ value: 0 }, {
          // @ts-expect-error - testing invalid input
          name: '',
        });
      }).toThrow(TypeError);

      expect(() => {
        createReactor({ value: 0 }, {
          // @ts-expect-error - testing invalid input
          name: '   ', // Only whitespace
        });
      }).toThrow(TypeError);
    });

    it('should throw on invalid subscriber', () => {
      const counter = createReactor({ value: 0 });

      expect(() => {
        // @ts-expect-error - testing invalid input
        counter.subscribe('not a function');
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error - testing invalid input
        counter.subscribe(null);
      }).toThrow(TypeError);
    });

    it('should throw on invalid updater', () => {
      const counter = createReactor({ value: 0 });

      expect(() => {
        // @ts-expect-error - testing invalid input
        counter.update('not a function');
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error - testing invalid input
        counter.update(null);
      }).toThrow(TypeError);
    });
  });
});
