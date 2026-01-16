/**
 * Logger plugin tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { logger } from '../src/plugins';

interface TestState {
  count: number;
  name: string;
  nested: {
    value: number;
    deep: {
      data: string;
    };
  };
}

describe('Logger Plugin', () => {
  let consoleSpy: {
    group: any;
    groupCollapsed: any;
    log: any;
    groupEnd: any;
    warn: any;
    error: any;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupCollapsed: vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  describe('Basic logging', () => {
    it('should log state changes', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        { plugins: [logger()] }
      );

      store.update(state => {
        state.count = 1;
      });

      expect(consoleSpy.group).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledTimes(2); // prev state + next state
      expect(consoleSpy.groupEnd).toHaveBeenCalled();
    });

    it('should use collapsed groups when specified', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        { plugins: [logger({ collapsed: true })] }
      );

      store.update(state => {
        state.count = 1;
      });

      expect(consoleSpy.groupCollapsed).toHaveBeenCalled();
      expect(consoleSpy.group).not.toHaveBeenCalled();
    });
  });

  describe('Filter by action name', () => {
    it('should filter actions by name', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              filter: (action) => action?.startsWith('user:') ?? false,
            }),
          ],
        }
      );

      // This should NOT be logged
      store.update(state => {
        state.count = 1;
      }, 'counter:increment');

      expect(consoleSpy.group).not.toHaveBeenCalled();

      // This SHOULD be logged
      store.update(state => {
        state.name = 'John';
      }, 'user:setName');

      expect(consoleSpy.group).toHaveBeenCalled();
    });
  });

  describe('Filter by state changes', () => {
    it('should filter based on state comparison', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              filter: (action, state, prevState) => {
                // Only log if count changed
                return state.count !== prevState.count;
              },
            }),
          ],
        }
      );

      // Change name only - should NOT log
      store.update(state => {
        state.name = 'John';
      });

      expect(consoleSpy.group).not.toHaveBeenCalled();

      // Change count - SHOULD log
      store.update(state => {
        state.count = 5;
      });

      expect(consoleSpy.group).toHaveBeenCalled();
    });

    it('should filter based on multiple conditions', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              filter: (action, state, prevState) => {
                // Only log if count increased and is even
                return state.count > prevState.count && state.count % 2 === 0;
              },
            }),
          ],
        }
      );

      // count = 1 (odd) - should NOT log
      store.update(state => {
        state.count = 1;
      });
      expect(consoleSpy.group).not.toHaveBeenCalled();

      // count = 2 (even and increased) - SHOULD log
      store.update(state => {
        state.count = 2;
      });
      expect(consoleSpy.group).toHaveBeenCalledTimes(1);

      // count = 3 (odd) - should NOT log
      store.update(state => {
        state.count = 3;
      });
      expect(consoleSpy.group).toHaveBeenCalledTimes(1);

      // count = 4 (even and increased) - SHOULD log
      store.update(state => {
        state.count = 4;
      });
      expect(consoleSpy.group).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance tracking', () => {
    it('should track execution time when enabled', async () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              trackPerformance: true,
            }),
          ],
        }
      );

      store.update(state => {
        state.count = 1;
      }, 'increment');

      // Check if duration is included in the log
      const groupCall = consoleSpy.group.mock.calls[0];
      expect(groupCall[0]).toMatch(/\(\d+\.\d+ms\)/);
    });

    it('should warn about slow actions', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              trackPerformance: true,
              slowThreshold: -1, // Negative threshold - all actions are slow
            }),
          ],
        }
      );

      store.update(state => {
        state.count = 1;
      }, 'slowAction');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const warnCall = consoleSpy.warn.mock.calls[0][0];
      expect(warnCall).toContain('Slow action detected');
    });

    it('should not warn if action is fast', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              trackPerformance: true,
              slowThreshold: 1000, // Very high threshold
            }),
          ],
        }
      );

      store.update(state => {
        state.count = 1;
      }, 'fastAction');

      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
  });

  describe('Timestamp', () => {
    it('should include timestamp when enabled', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              includeTimestamp: true,
            }),
          ],
        }
      );

      store.update(state => {
        state.count = 1;
      }, 'action');

      const groupCall = consoleSpy.group.mock.calls[0];
      expect(groupCall[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}/); // [HH:MM:SS format
    });
  });

  describe('Max depth limiting', () => {
    it('should limit object depth in logs', () => {
      const store = createReactor<TestState>(
        {
          count: 0,
          name: 'test',
          nested: {
            value: 1,
            deep: {
              data: 'test',
            },
          },
        },
        {
          plugins: [
            logger({
              maxDepth: 1,
            }),
          ],
        }
      );

      store.update(state => {
        state.nested.value = 2;
      });

      // Check logged state
      const logCalls = consoleSpy.log.mock.calls;
      const nextStateCall = logCalls[1]; // Second log call is next state

      const loggedState = nextStateCall[2];

      // At depth 1, nested should be limited
      expect(loggedState.nested).toBe('{...}');
    });

    it('should show full objects when maxDepth is high', () => {
      const store = createReactor<TestState>(
        {
          count: 0,
          name: 'test',
          nested: {
            value: 1,
            deep: {
              data: 'test',
            },
          },
        },
        {
          plugins: [
            logger({
              maxDepth: 10, // High depth
            }),
          ],
        }
      );

      store.update(state => {
        state.nested.deep.data = 'changed';
      });

      const logCalls = consoleSpy.log.mock.calls;
      const nextStateCall = logCalls[1];
      const loggedState = nextStateCall[2];

      // Should have full nested structure
      expect(loggedState.nested.deep.data).toBe('changed');
    });
  });

  describe('Combined features', () => {
    it('should work with all features combined', () => {
      const store = createReactor<TestState>(
        { count: 0, name: 'test', nested: { value: 1, deep: { data: 'test' } } },
        {
          plugins: [
            logger({
              collapsed: true,
              filter: (action, state) => state.count % 2 === 0,
              trackPerformance: true,
              slowThreshold: 100,
              includeTimestamp: true,
              maxDepth: 2,
            }),
          ],
        }
      );

      // count = 1 (odd) - filtered out
      store.update(state => {
        state.count = 1;
      }, 'action1');

      expect(consoleSpy.groupCollapsed).not.toHaveBeenCalled();

      // count = 2 (even) - should log
      store.update(state => {
        state.count = 2;
      }, 'action2');

      expect(consoleSpy.groupCollapsed).toHaveBeenCalled();
      const groupCall = consoleSpy.groupCollapsed.mock.calls[0];

      // Should include timestamp and duration
      expect(groupCall[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}/);
      expect(groupCall[0]).toMatch(/\(\d+\.\d+ms\)/);
    });
  });
});
