/**
 * Undo/Redo history tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoRedoHistory } from '../src/history/undo-redo';

interface TestState {
  value: number;
  name: string;
}

describe('UndoRedoHistory', () => {
  let history: UndoRedoHistory<TestState>;
  const initialState: TestState = { value: 0, name: 'initial' };

  beforeEach(() => {
    history = new UndoRedoHistory(initialState, 10);
  });

  it('should initialize with initial state', () => {
    const stack = history.getStack();

    expect(stack.current).toEqual(initialState);
    expect(stack.past).toHaveLength(0);
    expect(stack.future).toHaveLength(0);
  });

  it('should push new state', () => {
    const prevState = { value: 0, name: 'initial' };
    const nextState = { value: 1, name: 'updated' };

    history.push(prevState, nextState);

    const stack = history.getStack();
    expect(stack.past).toHaveLength(1);
    expect(stack.past[0].state).toEqual(prevState);
  });

  it('should undo changes', () => {
    const state1 = { value: 0, name: 'initial' };
    const state2 = { value: 1, name: 'step1' };
    const state3 = { value: 2, name: 'step2' };

    history.push(state1, state2);
    history.push(state2, state3);

    const undone = history.undo();

    expect(undone).toEqual(state2);
    expect(history.canUndo()).toBe(true);
  });

  it('should redo changes', () => {
    const state1 = { value: 0, name: 'initial' };
    const state2 = { value: 1, name: 'step1' };

    history.push(state1, state2);
    history.undo();

    const redone = history.redo();

    expect(redone).toEqual(state2);
  });

  it('should handle canUndo() correctly', () => {
    expect(history.canUndo()).toBe(false);

    history.push(initialState, { value: 1, name: 'step1' });

    expect(history.canUndo()).toBe(true);
  });

  it('should handle canRedo() correctly', () => {
    expect(history.canRedo()).toBe(false);

    history.push(initialState, { value: 1, name: 'step1' });
    history.undo();

    expect(history.canRedo()).toBe(true);
  });

  it('should clear future on new push after undo', () => {
    history.push(initialState, { value: 1, name: 'step1' });
    history.push({ value: 1, name: 'step1' }, { value: 2, name: 'step2' });

    history.undo();

    expect(history.canRedo()).toBe(true);

    // New push should clear future
    history.push({ value: 1, name: 'step1' }, { value: 3, name: 'step3' });

    expect(history.canRedo()).toBe(false);
  });

  it('should respect history limit', () => {
    const smallHistory = new UndoRedoHistory(initialState, 3);

    for (let i = 1; i <= 10; i++) {
      smallHistory.push(
        { value: i - 1, name: `step${i - 1}` },
        { value: i, name: `step${i}` }
      );
    }

    const stack = smallHistory.getStack();

    // Should only keep last 3 entries
    expect(stack.past.length).toBeLessThanOrEqual(3);
  });

  it('should handle batch operations', () => {
    history.startBatch();

    history.push(initialState, { value: 1, name: 'step1' });
    history.push({ value: 1, name: 'step1' }, { value: 2, name: 'step2' });
    history.push({ value: 2, name: 'step2' }, { value: 3, name: 'step3' });

    history.endBatch();

    const stack = history.getStack();

    // Batch should be saved as single entry
    expect(stack.past).toHaveLength(1);
    expect(stack.past[0].action).toBe('batch');
  });

  it('should clear history', () => {
    history.push(initialState, { value: 1, name: 'step1' });
    history.push({ value: 1, name: 'step1' }, { value: 2, name: 'step2' });

    history.clear();

    const stack = history.getStack();

    expect(stack.past).toHaveLength(0);
    expect(stack.future).toHaveLength(0);
  });

  it('should handle action labels', () => {
    history.push(initialState, { value: 1, name: 'step1' }, 'increment');

    const stack = history.getStack();

    expect(stack.past[0].action).toBe('increment');
  });

  it('should include timestamps', () => {
    const beforeTime = Date.now();

    history.push(initialState, { value: 1, name: 'step1' });

    const afterTime = Date.now();
    const stack = history.getStack();

    expect(stack.past[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(stack.past[0].timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should return null when undo is not available', () => {
    const result = history.undo();

    expect(result).toBeNull();
  });

  it('should return null when redo is not available', () => {
    const result = history.redo();

    expect(result).toBeNull();
  });
});
