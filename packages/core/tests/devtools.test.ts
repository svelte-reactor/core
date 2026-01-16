/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { createDevTools } from '../src/devtools/devtools';
import { undoRedo } from '../src/plugins';

interface CounterState {
  value: number;
}

describe('DevTools', () => {
  describe('createDevTools', () => {
    it('should create devtools instance', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
        name: 'TestReactor',
      });

      const devtools = createDevTools(reactor, { name: 'Test' });

      expect(devtools.name).toBe('Test');
      expect(devtools.history).toBeDefined();
    });

    it('should use reactor name if not provided', () => {
      const reactor = createReactor({ value: 0 });
      const devtools = createDevTools(reactor);

      expect(devtools.name).toBe('Reactor');
    });
  });

  describe('Time Travel', () => {
    it('should time travel to specific history index', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      // Create history
      reactor.update((s) => { s.value = 1; });
      reactor.update((s) => { s.value = 2; });
      reactor.update((s) => { s.value = 3; });

      expect(reactor.state.value).toBe(3);

      // Time travel to index 0 (value should be 0)
      devtools.timeTravel(0);
      expect(reactor.state.value).toBe(0);

      // Time travel to index 1 (value should be 1)
      devtools.timeTravel(1);
      expect(reactor.state.value).toBe(1);
    });

    it('should handle invalid time travel index', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      reactor.update((s) => { s.value = 1; });

      // Try invalid index (should not crash)
      devtools.timeTravel(-1);
      expect(reactor.state.value).toBe(1);

      devtools.timeTravel(999);
      expect(reactor.state.value).toBe(1);
    });
  });

  describe('Export/Import State', () => {
    it('should export state as JSON', () => {
      const reactor = createReactor({ value: 42 }, {
        plugins: [undoRedo()],
        name: 'ExportTest',
      });

      const devtools = createDevTools(reactor);

      const exported = devtools.exportState();
      const data = JSON.parse(exported);

      expect(data.name).toBe('Reactor');
      expect(data.state.value).toBe(42);
      expect(data.timestamp).toBeDefined();
    });

    it('should import state from JSON', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      const importData = JSON.stringify({
        name: 'ImportTest',
        state: { value: 99 },
        timestamp: Date.now(),
      });

      devtools.importState(importData);

      expect(reactor.state.value).toBe(99);
    });

    it('should handle invalid import data', () => {
      const reactor = createReactor({ value: 0 });
      const devtools = createDevTools(reactor);

      expect(() => {
        devtools.importState('invalid json');
      }).toThrow();

      expect(() => {
        devtools.importState('{}');
      }).toThrow();
    });
  });

  describe('Inspection', () => {
    it('should provide inspection data', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
        name: 'InspectTest',
      });

      const devtools = createDevTools(reactor);

      const inspection = devtools.inspect();

      expect(inspection.name).toBe('InspectTest');
      expect(inspection.state).toBeDefined();
      expect(inspection.history).toBeDefined();
      expect(inspection.plugins).toContain('undo-redo');
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      reactor.update((s) => { s.value = 1; });
      reactor.update((s) => { s.value = 2; });
      reactor.update((s) => { s.value = 3; });

      expect(reactor.state.value).toBe(3);

      devtools.reset();

      expect(reactor.state.value).toBe(0);
    });

    it('should handle reset with no history', () => {
      const reactor = createReactor({ value: 0 });
      const devtools = createDevTools(reactor);

      // Should not crash
      devtools.reset();
    });
  });

  describe('Get State At', () => {
    it('should get state at specific index', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      reactor.update((s) => { s.value = 1; });
      reactor.update((s) => { s.value = 2; });
      reactor.update((s) => { s.value = 3; });

      const state0 = devtools.getStateAt(0);
      expect(state0?.value).toBe(0);

      const state1 = devtools.getStateAt(1);
      expect(state1?.value).toBe(1);

      const state2 = devtools.getStateAt(2);
      expect(state2?.value).toBe(2);
    });

    it('should return null for invalid index', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      expect(devtools.getStateAt(-1)).toBeNull();
      expect(devtools.getStateAt(999)).toBeNull();
    });
  });

  describe('Subscribe', () => {
    it('should subscribe to state changes', (done) => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      let callCount = 0;
      const unsubscribe = devtools.subscribe((inspection) => {
        callCount++;
        if (callCount > 2) {
          unsubscribe();
          done();
        }
      });

      reactor.update((s) => { s.value = 1; });
    });
  });

  describe('Integration with Reactor', () => {
    it('should work with complex state updates', () => {
      interface TodoState {
        items: Array<{ id: number; text: string; done: boolean }>;
      }

      const reactor = createReactor<TodoState>({ items: [] }, {
        plugins: [undoRedo()],
      });

      const devtools = createDevTools(reactor);

      // Add items
      reactor.update((s) => {
        s.items.push({ id: 1, text: 'Task 1', done: false });
      });
      reactor.update((s) => {
        s.items.push({ id: 2, text: 'Task 2', done: false });
      });

      expect(reactor.state.items.length).toBe(2);

      // Time travel back
      devtools.timeTravel(0);
      expect(reactor.state.items.length).toBe(0);

      // Export and import
      const exported = devtools.exportState();
      reactor.update((s) => {
        s.items.push({ id: 3, text: 'Task 3', done: false });
      });

      devtools.importState(exported);
      expect(reactor.state.items.length).toBe(0);
    });
  });
});
