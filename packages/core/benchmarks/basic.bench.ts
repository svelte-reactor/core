/**
 * Basic reactor performance benchmarks
 */

import { bench, describe } from 'vitest';
import { createReactor } from '../src/index.js';
import { undoRedo } from '../src/plugins/index.js';

describe('Reactor Performance', () => {
  describe('State Updates', () => {
    bench('simple state update', () => {
      const reactor = createReactor({ value: 0 });
      reactor.update((s) => { s.value++; });
    });

    bench('100 sequential updates', () => {
      const reactor = createReactor({ value: 0 });
      for (let i = 0; i < 100; i++) {
        reactor.update((s) => { s.value++; });
      }
    });

    bench('complex state update', () => {
      const reactor = createReactor({
        user: { name: 'Test', age: 30 },
        items: [1, 2, 3],
        settings: { theme: 'dark' },
      });

      reactor.update((s) => {
        s.user.age++;
        s.items.push(4);
        s.settings.theme = 'light';
      });
    });
  });

  describe('Undo/Redo', () => {
    bench('update with undo/redo', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      reactor.update((s) => { s.value = 1; });
      reactor.undo();
      reactor.redo();
    });

    bench('100 updates with history', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo({ limit: 100 })],
      });

      for (let i = 0; i < 100; i++) {
        reactor.update((s) => { s.value = i; });
      }
    });

    bench('batch 100 updates', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });

      reactor.batch(() => {
        for (let i = 0; i < 100; i++) {
          reactor.update((s) => { s.value++; });
        }
      });
    });
  });

  describe('History Operations', () => {
    bench('50 undos', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo({ limit: 100 })],
      });

      for (let i = 0; i < 50; i++) {
        reactor.update((s) => { s.value = i; });
      }

      for (let i = 0; i < 50; i++) {
        reactor.undo();
      }
    });

    bench('50 redos', () => {
      const reactor = createReactor({ value: 0 }, {
        plugins: [undoRedo({ limit: 100 })],
      });

      for (let i = 0; i < 50; i++) {
        reactor.update((s) => { s.value = i; });
      }

      for (let i = 0; i < 50; i++) {
        reactor.undo();
      }

      for (let i = 0; i < 50; i++) {
        reactor.redo();
      }
    });
  });

  describe('Large State', () => {
    bench('update large array (1000 items)', () => {
      const reactor = createReactor({
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i })),
      });

      reactor.update((s) => {
        s.items.push({ id: 1000, value: 1000 });
      });
    });

    bench('update large object (100 properties)', () => {
      const reactor = createReactor(
        Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, i]))
      );

      reactor.update((s) => {
        (s as any).key0 = 999;
      });
    });
  });

  describe('Reactor Creation', () => {
    bench('create simple reactor', () => {
      createReactor({ value: 0 });
    });

    bench('create reactor with undo/redo', () => {
      createReactor({ value: 0 }, {
        plugins: [undoRedo()],
      });
    });

    bench('create reactor with complex state', () => {
      createReactor({
        user: { name: 'Test', age: 30, email: 'test@example.com' },
        items: Array.from({ length: 10 }, (_, i) => ({ id: i, text: `Item ${i}` })),
        settings: { theme: 'dark', notifications: true },
      });
    });
  });
});
