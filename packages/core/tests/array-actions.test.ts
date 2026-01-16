/**
 * Array Actions Helper tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { arrayActions } from '../src/helpers/array-actions';
import { undoRedo } from '../src/plugins';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

interface TodoState {
  items: Todo[];
}

describe('arrayActions', () => {
  let todos: ReturnType<typeof createReactor<TodoState>>;
  let actions: ReturnType<typeof arrayActions<TodoState, 'items', Todo>>;

  beforeEach(() => {
    todos = createReactor<TodoState>({ items: [] });
    actions = arrayActions(todos, 'items', { idKey: 'id' });
  });

  describe('Basic CRUD operations', () => {
    it('should add items', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.add({ id: '2', text: 'Walk dog', done: false });

      expect(todos.state.items.length).toBe(2);
      expect(todos.state.items[0].text).toBe('Buy milk');
      expect(todos.state.items[1].text).toBe('Walk dog');
    });

    it('should update items', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.update('1', { done: true });

      expect(todos.state.items[0].done).toBe(true);
      expect(todos.state.items[0].text).toBe('Buy milk');
    });

    it('should update items using updater function', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.updateBy('1', (item) => {
        item.done = true;
        item.text = 'Buy milk and eggs';
      });

      expect(todos.state.items[0].done).toBe(true);
      expect(todos.state.items[0].text).toBe('Buy milk and eggs');
    });

    it('should remove items', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.add({ id: '2', text: 'Walk dog', done: false });

      actions.remove('1');

      expect(todos.state.items.length).toBe(1);
      expect(todos.state.items[0].id).toBe('2');
    });

    it('should clear all items', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.add({ id: '2', text: 'Walk dog', done: false });

      actions.clear();

      expect(todos.state.items.length).toBe(0);
    });
  });

  describe('Advanced operations', () => {
    beforeEach(() => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.add({ id: '2', text: 'Walk dog', done: true });
      actions.add({ id: '3', text: 'Read book', done: false });
    });

    it('should toggle boolean fields', () => {
      expect(todos.state.items[0].done).toBe(false);

      actions.toggle('1', 'done');

      expect(todos.state.items[0].done).toBe(true);

      actions.toggle('1', 'done');

      expect(todos.state.items[0].done).toBe(false);
    });

    it('should remove items matching predicate', () => {
      actions.removeWhere((item) => item.done);

      expect(todos.state.items.length).toBe(2);
      expect(todos.state.items.every((item) => !item.done)).toBe(true);
    });

    it('should filter items', () => {
      actions.filter((item) => !item.done);

      expect(todos.state.items.length).toBe(2);
      expect(todos.state.items[0].id).toBe('1');
      expect(todos.state.items[1].id).toBe('3');
    });

    it('should set entire array', () => {
      const newItems: Todo[] = [
        { id: '4', text: 'New task 1', done: false },
        { id: '5', text: 'New task 2', done: false },
      ];

      actions.set(newItems);

      expect(todos.state.items.length).toBe(2);
      expect(todos.state.items[0].id).toBe('4');
      expect(todos.state.items[1].id).toBe('5');
    });
  });

  describe('Query operations', () => {
    beforeEach(() => {
      actions.add({ id: '1', text: 'Buy milk', done: false });
      actions.add({ id: '2', text: 'Walk dog', done: true });
      actions.add({ id: '3', text: 'Read book', done: false });
    });

    it('should find item by id', () => {
      const item = actions.find('2');

      expect(item).toBeDefined();
      expect(item?.text).toBe('Walk dog');
      expect(item?.done).toBe(true);
    });

    it('should return undefined for non-existent id', () => {
      const item = actions.find('999');

      expect(item).toBeUndefined();
    });

    it('should check if item exists', () => {
      expect(actions.has('1')).toBe(true);
      expect(actions.has('2')).toBe(true);
      expect(actions.has('999')).toBe(false);
    });

    it('should count items', () => {
      expect(actions.count()).toBe(3);

      actions.add({ id: '4', text: 'New task', done: false });

      expect(actions.count()).toBe(4);

      actions.remove('1');

      expect(actions.count()).toBe(3);
    });
  });

  describe('Integration with undoRedo', () => {
    it('should work with undo/redo', () => {
      const todosWithUndo = createReactor<TodoState>(
        { items: [] },
        {
          plugins: [undoRedo({ limit: 10 })],
        }
      );
      const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

      actionsWithUndo.add({ id: '1', text: 'Buy milk', done: false });
      expect(todosWithUndo.state.items.length).toBe(1);

      actionsWithUndo.add({ id: '2', text: 'Walk dog', done: false });
      expect(todosWithUndo.state.items.length).toBe(2);

      todosWithUndo.undo();
      expect(todosWithUndo.state.items.length).toBe(1);

      todosWithUndo.undo();
      expect(todosWithUndo.state.items.length).toBe(0);

      todosWithUndo.redo();
      expect(todosWithUndo.state.items.length).toBe(1);
      expect(todosWithUndo.state.items[0].text).toBe('Buy milk');
    });

    it('should have proper action names in history', () => {
      const todosWithUndo = createReactor<TodoState>(
        { items: [] },
        {
          plugins: [undoRedo({ limit: 10 })],
        }
      );
      const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

      actionsWithUndo.add({ id: '1', text: 'Buy milk', done: false });
      actionsWithUndo.update('1', { done: true });
      actionsWithUndo.remove('1');

      const history = todosWithUndo.getHistory();

      expect(history[0].action).toBe('items:add');
      expect(history[1].action).toBe('items:update');
      expect(history[2].action).toBe('items:remove');
    });
  });

  describe('Custom options', () => {
    it('should work with custom idKey', () => {
      interface CustomItem {
        uuid: string;
        name: string;
      }

      const store = createReactor<{ data: CustomItem[] }>({ data: [] });
      const customActions = arrayActions(store, 'data', { idKey: 'uuid' });

      customActions.add({ uuid: 'abc-123', name: 'Item 1' });
      customActions.add({ uuid: 'def-456', name: 'Item 2' });

      expect(store.state.data.length).toBe(2);

      customActions.remove('abc-123');

      expect(store.state.data.length).toBe(1);
      expect(store.state.data[0].uuid).toBe('def-456');
    });

    it('should work with custom action prefix', () => {
      const todosWithUndo = createReactor<TodoState>(
        { items: [] },
        {
          plugins: [undoRedo({ limit: 10 })],
        }
      );
      const actionsWithPrefix = arrayActions(todosWithUndo, 'items', {
        idKey: 'id',
        actionPrefix: 'todo',
      });

      actionsWithPrefix.add({ id: '1', text: 'Buy milk', done: false });

      const history = todosWithUndo.getHistory();
      expect(history[0].action).toBe('todo:add');
    });
  });

  describe('Edge cases', () => {
    it('should handle update on non-existent id gracefully', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });

      // Should not throw, just do nothing
      expect(() => {
        actions.update('999', { done: true });
      }).not.toThrow();

      expect(todos.state.items.length).toBe(1);
      expect(todos.state.items[0].done).toBe(false);
    });

    it('should handle remove on non-existent id gracefully', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });

      // Should not throw, just do nothing
      expect(() => {
        actions.remove('999');
      }).not.toThrow();

      expect(todos.state.items.length).toBe(1);
    });

    it('should handle toggle on non-existent id gracefully', () => {
      actions.add({ id: '1', text: 'Buy milk', done: false });

      // Should not throw, just do nothing
      expect(() => {
        actions.toggle('999', 'done');
      }).not.toThrow();

      expect(todos.state.items.length).toBe(1);
    });

    it('should throw error if field is not an array', () => {
      const invalidStore = createReactor({ items: 'not an array' as any });

      expect(() => {
        const invalidActions = arrayActions(invalidStore, 'items' as any);
        invalidActions.add({ id: '1', text: 'Test', done: false });
      }).toThrow("[arrayActions:add] Field 'items' must be an array");
    });
  });

  describe('New features: sort, bulkUpdate, bulkRemove', () => {
    describe('sort()', () => {
      it('should sort items by priority (ascending)', () => {
        interface TodoWithPriority {
          id: string;
          text: string;
          priority: number;
        }

        const store = createReactor<{ items: TodoWithPriority[] }>({ items: [] });
        const actions = arrayActions(store, 'items', { idKey: 'id' });

        actions.add({ id: '1', text: 'Low priority', priority: 3 });
        actions.add({ id: '2', text: 'High priority', priority: 1 });
        actions.add({ id: '3', text: 'Medium priority', priority: 2 });

        actions.sort((a, b) => a.priority - b.priority);

        expect(store.state.items[0].priority).toBe(1);
        expect(store.state.items[1].priority).toBe(2);
        expect(store.state.items[2].priority).toBe(3);
      });

      it('should sort items by date (descending - newest first)', () => {
        interface TodoWithDate {
          id: string;
          text: string;
          createdAt: number;
        }

        const store = createReactor<{ items: TodoWithDate[] }>({ items: [] });
        const actions = arrayActions(store, 'items', { idKey: 'id' });

        actions.add({ id: '1', text: 'Old task', createdAt: 1000 });
        actions.add({ id: '2', text: 'New task', createdAt: 3000 });
        actions.add({ id: '3', text: 'Middle task', createdAt: 2000 });

        actions.sort((a, b) => b.createdAt - a.createdAt);

        expect(store.state.items[0].createdAt).toBe(3000);
        expect(store.state.items[1].createdAt).toBe(2000);
        expect(store.state.items[2].createdAt).toBe(1000);
      });

      it('should sort items alphabetically', () => {
        actions.add({ id: '1', text: 'Zebra', done: false });
        actions.add({ id: '2', text: 'Apple', done: false });
        actions.add({ id: '3', text: 'Mango', done: false });

        actions.sort((a, b) => a.text.localeCompare(b.text));

        expect(todos.state.items[0].text).toBe('Apple');
        expect(todos.state.items[1].text).toBe('Mango');
        expect(todos.state.items[2].text).toBe('Zebra');
      });

      it('should work with undo/redo', () => {
        const todosWithUndo = createReactor<TodoState>(
          { items: [] },
          { plugins: [undoRedo({ limit: 10 })] }
        );
        const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

        actionsWithUndo.add({ id: '1', text: 'C', done: false });
        actionsWithUndo.add({ id: '2', text: 'A', done: false });
        actionsWithUndo.add({ id: '3', text: 'B', done: false });

        actionsWithUndo.sort((a, b) => a.text.localeCompare(b.text));

        expect(todosWithUndo.state.items[0].text).toBe('A');

        todosWithUndo.undo();

        expect(todosWithUndo.state.items[0].text).toBe('C');
      });
    });

    describe('bulkUpdate()', () => {
      it('should update multiple items at once', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });
        actions.add({ id: '2', text: 'Task 2', done: false });
        actions.add({ id: '3', text: 'Task 3', done: false });

        actions.bulkUpdate(['1', '2'], { done: true });

        expect(todos.state.items[0].done).toBe(true);
        expect(todos.state.items[1].done).toBe(true);
        expect(todos.state.items[2].done).toBe(false);
      });

      it('should handle empty ids array', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });

        expect(() => {
          actions.bulkUpdate([], { done: true });
        }).not.toThrow();

        expect(todos.state.items[0].done).toBe(false);
      });

      it('should handle non-existent ids gracefully', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });

        expect(() => {
          actions.bulkUpdate(['1', '999', '888'], { done: true });
        }).not.toThrow();

        expect(todos.state.items[0].done).toBe(true);
      });

      it('should work with undo/redo', () => {
        const todosWithUndo = createReactor<TodoState>(
          { items: [] },
          { plugins: [undoRedo({ limit: 10 })] }
        );
        const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

        actionsWithUndo.add({ id: '1', text: 'Task 1', done: false });
        actionsWithUndo.add({ id: '2', text: 'Task 2', done: false });

        actionsWithUndo.bulkUpdate(['1', '2'], { done: true });

        expect(todosWithUndo.state.items[0].done).toBe(true);
        expect(todosWithUndo.state.items[1].done).toBe(true);

        todosWithUndo.undo();

        expect(todosWithUndo.state.items[0].done).toBe(false);
        expect(todosWithUndo.state.items[1].done).toBe(false);
      });

      it('should have proper action name in history', () => {
        const todosWithUndo = createReactor<TodoState>(
          { items: [] },
          { plugins: [undoRedo({ limit: 10 })] }
        );
        const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

        actionsWithUndo.add({ id: '1', text: 'Task 1', done: false });
        actionsWithUndo.bulkUpdate(['1'], { done: true });

        const history = todosWithUndo.getHistory();
        expect(history[1].action).toBe('items:bulkUpdate');
      });
    });

    describe('bulkRemove()', () => {
      it('should remove multiple items by ids', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });
        actions.add({ id: '2', text: 'Task 2', done: false });
        actions.add({ id: '3', text: 'Task 3', done: false });
        actions.add({ id: '4', text: 'Task 4', done: false });

        actions.bulkRemove(['1', '3']);

        expect(todos.state.items.length).toBe(2);
        expect(todos.state.items[0].id).toBe('2');
        expect(todos.state.items[1].id).toBe('4');
      });

      it('should remove multiple items by predicate', () => {
        actions.add({ id: '1', text: 'Task 1', done: true });
        actions.add({ id: '2', text: 'Task 2', done: false });
        actions.add({ id: '3', text: 'Task 3', done: true });
        actions.add({ id: '4', text: 'Task 4', done: false });

        actions.bulkRemove(item => item.done);

        expect(todos.state.items.length).toBe(2);
        expect(todos.state.items[0].id).toBe('2');
        expect(todos.state.items[1].id).toBe('4');
      });

      it('should handle empty ids array', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });

        expect(() => {
          actions.bulkRemove([]);
        }).not.toThrow();

        expect(todos.state.items.length).toBe(1);
      });

      it('should handle non-existent ids gracefully', () => {
        actions.add({ id: '1', text: 'Task 1', done: false });

        expect(() => {
          actions.bulkRemove(['999', '888']);
        }).not.toThrow();

        expect(todos.state.items.length).toBe(1);
      });

      it('should work with undo/redo', () => {
        const todosWithUndo = createReactor<TodoState>(
          { items: [] },
          { plugins: [undoRedo({ limit: 10 })] }
        );
        const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

        actionsWithUndo.add({ id: '1', text: 'Task 1', done: false });
        actionsWithUndo.add({ id: '2', text: 'Task 2', done: false });
        actionsWithUndo.add({ id: '3', text: 'Task 3', done: false });

        actionsWithUndo.bulkRemove(['1', '2']);

        expect(todosWithUndo.state.items.length).toBe(1);
        expect(todosWithUndo.state.items[0].id).toBe('3');

        todosWithUndo.undo();

        expect(todosWithUndo.state.items.length).toBe(3);
        expect(todosWithUndo.state.items[0].id).toBe('1');
      });

      it('should have proper action name in history', () => {
        const todosWithUndo = createReactor<TodoState>(
          { items: [] },
          { plugins: [undoRedo({ limit: 10 })] }
        );
        const actionsWithUndo = arrayActions(todosWithUndo, 'items', { idKey: 'id' });

        actionsWithUndo.add({ id: '1', text: 'Task 1', done: false });
        actionsWithUndo.bulkRemove(['1']);

        const history = todosWithUndo.getHistory();
        expect(history[1].action).toBe('items:bulkRemove');
      });
    });
  });
});
