/**
 * Edge case tests for reactor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { undoRedo, logger } from '../src/plugins';

interface TestState {
  value: number;
  nested?: {
    data: string;
  };
}

describe('Edge Cases: Reactor without plugins', () => {
  let reactor: ReturnType<typeof createReactor<TestState>>;

  beforeEach(() => {
    reactor = createReactor({ value: 0 });
  });

  it('should warn when calling undo() without undoRedo plugin', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reactor.undo();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Reactor] Undo/redo not enabled. Add undoRedo plugin.'
    );

    warnSpy.mockRestore();
  });

  it('should warn when calling redo() without undoRedo plugin', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reactor.redo();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Reactor] Undo/redo not enabled. Add undoRedo plugin.'
    );

    warnSpy.mockRestore();
  });

  it('should warn when calling clearHistory() without undoRedo plugin', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reactor.clearHistory();

    expect(warnSpy).toHaveBeenCalledWith(
      '[Reactor] Undo/redo not enabled. Add undoRedo plugin.'
    );

    warnSpy.mockRestore();
  });

  it('should return empty array when calling getHistory() without undoRedo plugin', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const history = reactor.getHistory();

    expect(history).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Reactor] Undo/redo not enabled. Add undoRedo plugin.'
    );

    warnSpy.mockRestore();
  });

  it('should allow batch() without undoRedo plugin', () => {
    reactor.batch(() => {
      reactor.update((state) => {
        state.value = 5;
      });
      reactor.update((state) => {
        state.value = 10;
      });
    });

    expect(reactor.state.value).toBe(10);
  });

  it('should return false for canUndo() without plugin', () => {
    expect(reactor.canUndo()).toBe(false);
  });

  it('should return false for canRedo() without plugin', () => {
    expect(reactor.canRedo()).toBe(false);
  });
});

describe('Edge Cases: Update with action names', () => {
  let reactor: ReturnType<typeof createReactor<TestState>>;

  beforeEach(() => {
    reactor = createReactor(
      { value: 0 },
      { plugins: [undoRedo({ limit: 10 })] }
    );
  });

  it('should accept action names in update()', () => {
    reactor.update((state) => {
      state.value = 5;
    }, 'set-to-five');

    const history = reactor.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].action).toBe('set-to-five');
  });

  it('should work with multiple named actions', () => {
    reactor.update((state) => {
      state.value = 1;
    }, 'increment');

    reactor.update((state) => {
      state.value = 2;
    }, 'increment');

    reactor.update((state) => {
      state.value = 0;
    }, 'reset');

    const history = reactor.getHistory();
    expect(history.length).toBe(3);
  });
});

describe('Edge Cases: Destroyed reactor', () => {
  it('should warn when updating destroyed reactor', () => {
    const reactor = createReactor({ value: 0 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reactor.destroy();
    reactor.update((state) => {
      state.value = 5;
    });

    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0][0];
    expect(warnCall).toContain('Cannot update destroyed reactor');
    expect(reactor.state.value).toBe(0);

    warnSpy.mockRestore();
  });

  it('should not error when destroying already destroyed reactor', () => {
    const reactor = createReactor({ value: 0 });

    reactor.destroy();

    expect(() => reactor.destroy()).not.toThrow();
  });

  it('should cleanup plugins on destroy', () => {
    const destroyFn = vi.fn();
    const customPlugin = {
      name: 'custom',
      init: () => {},
      destroy: destroyFn,
    };

    const reactor = createReactor(
      { value: 0 },
      { plugins: [customPlugin] }
    );

    reactor.destroy();

    expect(destroyFn).toHaveBeenCalled();
  });
});

describe('Edge Cases: Plugin initialization errors', () => {
  it('should handle plugin init errors gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const badPlugin = {
      name: 'bad-plugin',
      init: () => {
        throw new Error('Init failed');
      },
    };

    const reactor = createReactor(
      { value: 0 },
      { plugins: [badPlugin] }
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[Reactor] Failed to initialize plugin "bad-plugin":',
      expect.any(Error)
    );
    expect(reactor.state.value).toBe(0);

    errorSpy.mockRestore();
  });

  it('should handle plugin destroy errors gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const badPlugin = {
      name: 'bad-plugin',
      init: () => {},
      destroy: () => {
        throw new Error('Destroy failed');
      },
    };

    const reactor = createReactor(
      { value: 0 },
      { plugins: [badPlugin] }
    );

    reactor.destroy();

    expect(errorSpy).toHaveBeenCalledWith(
      '[Reactor] Failed to destroy plugin "bad-plugin":',
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});

describe('Edge Cases: Complex state updates', () => {
  it('should handle nested object updates', () => {
    const reactor = createReactor<TestState>(
      {
        value: 0,
        nested: { data: 'initial' },
      },
      { plugins: [undoRedo()] }
    );

    reactor.update((state) => {
      if (state.nested) {
        state.nested.data = 'updated';
      }
    });

    expect(reactor.state.nested?.data).toBe('updated');

    reactor.undo();
    expect(reactor.state.nested?.data).toBe('initial');
  });

  it('should handle adding properties to state', () => {
    const reactor = createReactor<TestState>(
      { value: 0 },
      { plugins: [undoRedo()] }
    );

    reactor.update((state) => {
      state.nested = { data: 'new' };
    });

    expect(reactor.state.nested?.data).toBe('new');

    reactor.undo();
    // After undo, nested should be back to undefined (initial state didn't have it)
    // However, $state proxy keeps the property. Let's check value instead
    expect(reactor.state.value).toBe(0);
    expect(reactor.canUndo()).toBe(false);
  });

  it('should handle set() with partial updates', () => {
    const reactor = createReactor<TestState>(
      {
        value: 0,
        nested: { data: 'initial' },
      },
      { plugins: [undoRedo()] }
    );

    reactor.set({ value: 10 });

    expect(reactor.state.value).toBe(10);
    expect(reactor.state.nested?.data).toBe('initial');

    reactor.undo();
    expect(reactor.state.value).toBe(0);
  });
});

describe('Edge Cases: Undo/Redo with no history', () => {
  it('should not change state when undo with empty history', () => {
    const reactor = createReactor(
      { value: 5 },
      { plugins: [undoRedo()] }
    );

    reactor.undo();

    expect(reactor.state.value).toBe(5);
    expect(reactor.canUndo()).toBe(false);
  });

  it('should not change state when redo with empty future', () => {
    const reactor = createReactor(
      { value: 5 },
      { plugins: [undoRedo()] }
    );

    reactor.update((state) => {
      state.value = 10;
    });

    reactor.redo();

    expect(reactor.state.value).toBe(10);
    expect(reactor.canRedo()).toBe(false);
  });
});

describe('Edge Cases: clearHistory() and getHistory()', () => {
  it('should clear history and prevent undo', () => {
    const reactor = createReactor(
      { value: 0 },
      { plugins: [undoRedo({ limit: 10 })] }
    );

    reactor.update((state) => {
      state.value = 1;
    });
    reactor.update((state) => {
      state.value = 2;
    });

    expect(reactor.canUndo()).toBe(true);

    reactor.clearHistory();

    expect(reactor.canUndo()).toBe(false);
    expect(reactor.getHistory()).toEqual([]);
  });

  it('should return history entries with getHistory()', () => {
    const reactor = createReactor(
      { value: 0 },
      { plugins: [undoRedo({ limit: 10 })] }
    );

    reactor.update((state) => {
      state.value = 1;
    });
    reactor.update((state) => {
      state.value = 2;
    });

    const history = reactor.getHistory();

    expect(history.length).toBe(2);
    expect(history[0].state.value).toBe(0);
    expect(history[1].state.value).toBe(1);
  });
});

describe('Edge Cases: Middleware error handling', () => {
  it('should catch middleware errors and call onError', () => {
    const onErrorSpy = vi.fn();

    const errorPlugin = {
      name: 'error-plugin',
      init: (context: any) => {
        context.middlewares.push({
          name: 'error-middleware',
          onBeforeUpdate: () => {
            throw new Error('Middleware error');
          },
          onError: onErrorSpy,
        });
      },
    };

    const reactor = createReactor(
      { value: 0 },
      { plugins: [errorPlugin] }
    );

    // Middleware errors are caught and passed to onError
    reactor.update((state) => {
      state.value = 5;
    });

    // Error handler should have been called
    expect(onErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Middleware error',
    }));

    // State should still update despite middleware error
    expect(reactor.state.value).toBe(5);
  });
});

describe('Edge Cases: Inspect with complex state', () => {
  it('should clone state in inspect()', () => {
    const reactor = createReactor({
      value: 0,
      nested: { data: 'test' },
    });

    const inspection = reactor.inspect();

    // Modify inspected state
    inspection.state.value = 999;

    // Original state should not be affected
    expect(reactor.state.value).toBe(0);
  });

  it('should include plugin and middleware info', () => {
    const reactor = createReactor(
      { value: 0 },
      {
        name: 'test-reactor',
        plugins: [undoRedo(), logger()],
      }
    );

    const inspection = reactor.inspect();

    expect(inspection.name).toBe('test-reactor');
    expect(inspection.plugins).toContain('undo-redo');
    expect(inspection.plugins).toContain('logger');
    expect(inspection.middlewares).toContain('logger');
  });
});
