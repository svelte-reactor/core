/**
 * Pagination Tests for arrayPagination helper
 * Testing pagination functionality with large datasets
 *
 * NOTE: Pagination was extracted from arrayActions in v0.2.9.
 * Use arrayPagination() separately from arrayActions().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { arrayActions } from '../src/helpers/array-actions.js';
import { arrayPagination } from '../src/helpers/array-pagination.js';

interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: number;
}

describe('arrayPagination', () => {
  let reactor: any;
  let actions: any;
  let pagination: any;

  beforeEach(() => {
    // Create reactor with 100 items
    const items: Todo[] = Array.from({ length: 100 }, (_, i) => ({
      id: `${i + 1}`,
      text: `Todo ${i + 1}`,
      done: false,
      priority: i + 1,
    }));

    reactor = createReactor({ items });
    actions = arrayActions(reactor, 'items', { idKey: 'id' });
    pagination = arrayPagination(reactor, 'items', {
      pageSize: 10,
      initialPage: 1,
    });
  });

  describe('getPage()', () => {
    it('should return first page by default', () => {
      const result = pagination.getPage();

      expect(result.items).toHaveLength(10);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(10);
      expect(result.totalItems).toBe(100);
      expect(result.pageSize).toBe(10);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);

      // Check first page items
      expect(result.items[0].id).toBe('1');
      expect(result.items[9].id).toBe('10');
    });

    it('should return correct middle page', () => {
      pagination.setPage(5);
      const result = pagination.getPage();

      expect(result.items).toHaveLength(10);
      expect(result.page).toBe(5);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);

      // Check middle page items
      expect(result.items[0].id).toBe('41');
      expect(result.items[9].id).toBe('50');
    });

    it('should return correct last page', () => {
      pagination.setPage(10);
      const result = pagination.getPage();

      expect(result.items).toHaveLength(10);
      expect(result.page).toBe(10);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);

      // Check last page items
      expect(result.items[0].id).toBe('91');
      expect(result.items[9].id).toBe('100');
    });

    it('should handle partial last page', () => {
      // Add only 5 more items (total 105)
      for (let i = 101; i <= 105; i++) {
        actions.add({
          id: `${i}`,
          text: `Todo ${i}`,
          done: false,
          priority: i,
        });
      }

      pagination.setPage(11);
      const result = pagination.getPage();

      expect(result.items).toHaveLength(5);
      expect(result.page).toBe(11);
      expect(result.totalPages).toBe(11);
      expect(result.totalItems).toBe(105);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });

    it('should handle empty array', () => {
      actions.clear();
      const result = pagination.getPage();

      expect(result.items).toHaveLength(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should handle array with fewer items than pageSize', () => {
      actions.clear();
      for (let i = 1; i <= 5; i++) {
        actions.add({
          id: `${i}`,
          text: `Todo ${i}`,
          done: false,
          priority: i,
        });
      }

      const result = pagination.getPage();

      expect(result.items).toHaveLength(5);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.totalItems).toBe(5);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('setPage()', () => {
    it('should change current page', () => {
      pagination.setPage(3);
      const result = pagination.getPage();

      expect(result.page).toBe(3);
      expect(result.items[0].id).toBe('21');
    });

    it('should warn and ignore invalid page (too high)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      pagination.setPage(11); // Only 10 pages
      const result = pagination.getPage();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.page).toBe(1); // Should stay on current page

      consoleSpy.mockRestore();
    });

    it('should warn and ignore invalid page (too low)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      pagination.setPage(0);
      const result = pagination.getPage();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.page).toBe(1); // Should stay on current page

      consoleSpy.mockRestore();
    });

    it('should handle negative page numbers', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      pagination.setPage(-1);
      const result = pagination.getPage();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.page).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe('nextPage()', () => {
    it('should move to next page', () => {
      const success = pagination.nextPage();
      const result = pagination.getPage();

      expect(success).toBe(true);
      expect(result.page).toBe(2);
      expect(result.items[0].id).toBe('11');
    });

    it('should return false when already on last page', () => {
      pagination.setPage(10);
      const success = pagination.nextPage();

      expect(success).toBe(false);
      expect(pagination.getPage().page).toBe(10);
    });

    it('should work multiple times', () => {
      pagination.nextPage();
      pagination.nextPage();
      pagination.nextPage();

      const result = pagination.getPage();
      expect(result.page).toBe(4);
    });
  });

  describe('prevPage()', () => {
    it('should move to previous page', () => {
      pagination.setPage(5);
      const success = pagination.prevPage();
      const result = pagination.getPage();

      expect(success).toBe(true);
      expect(result.page).toBe(4);
    });

    it('should return false when already on first page', () => {
      const success = pagination.prevPage();

      expect(success).toBe(false);
      expect(pagination.getPage().page).toBe(1);
    });

    it('should work multiple times', () => {
      pagination.setPage(5);
      pagination.prevPage();
      pagination.prevPage();
      pagination.prevPage();

      const result = pagination.getPage();
      expect(result.page).toBe(2);
    });
  });

  describe('firstPage()', () => {
    it('should jump to first page', () => {
      pagination.setPage(7);
      pagination.firstPage();

      const result = pagination.getPage();
      expect(result.page).toBe(1);
      expect(result.items[0].id).toBe('1');
    });

    it('should work when already on first page', () => {
      pagination.firstPage();

      const result = pagination.getPage();
      expect(result.page).toBe(1);
    });
  });

  describe('lastPage()', () => {
    it('should jump to last page', () => {
      pagination.lastPage();

      const result = pagination.getPage();
      expect(result.page).toBe(10);
      expect(result.items[0].id).toBe('91');
    });

    it('should work when already on last page', () => {
      pagination.setPage(10);
      pagination.lastPage();

      const result = pagination.getPage();
      expect(result.page).toBe(10);
    });

    it('should update when array size changes', () => {
      pagination.lastPage();
      expect(pagination.getPage().page).toBe(10);

      // Add 20 more items (now 12 pages)
      for (let i = 101; i <= 120; i++) {
        actions.add({
          id: `${i}`,
          text: `Todo ${i}`,
          done: false,
          priority: i,
        });
      }

      pagination.lastPage();
      expect(pagination.getPage().page).toBe(12);
    });
  });

  describe('getCurrentPage() and getTotalPages()', () => {
    it('should return current page number', () => {
      expect(pagination.getCurrentPage()).toBe(1);

      pagination.setPage(5);
      expect(pagination.getCurrentPage()).toBe(5);
    });

    it('should return total pages count', () => {
      expect(pagination.getTotalPages()).toBe(10);

      // Add more items
      for (let i = 101; i <= 150; i++) {
        actions.add({
          id: `${i}`,
          text: `Todo ${i}`,
          done: false,
          priority: i,
        });
      }

      expect(pagination.getTotalPages()).toBe(15);
    });
  });

  describe('Edge cases', () => {
    it('should clamp page when array shrinks', () => {
      pagination.setPage(10); // Page 10 of 10

      // Remove 50 items (now only 5 pages)
      for (let i = 1; i <= 50; i++) {
        actions.remove(`${i}`);
      }

      const result = pagination.getPage();
      expect(result.page).toBe(5); // Auto-clamped to last valid page
      expect(result.totalPages).toBe(5);
    });

    it('should work after filtering', () => {
      // Mark some as done
      for (let i = 1; i <= 30; i++) {
        actions.update(`${i}`, { done: true });
      }

      // Remove done items (70 items left, 7 pages)
      actions.removeWhere((item: Todo) => item.done);

      pagination.setPage(7);
      const result = pagination.getPage();

      expect(result.totalPages).toBe(7);
      expect(result.totalItems).toBe(70);
      expect(result.page).toBe(7);
    });

    it('should work after sorting', () => {
      // Sort by priority descending
      actions.sort((a: Todo, b: Todo) => b.priority - a.priority);

      const result = pagination.getPage();

      // First page should have highest priority items
      expect(result.items[0].priority).toBe(100);
      expect(result.items[9].priority).toBe(91);
    });

    it('should handle page navigation after bulk operations', () => {
      pagination.setPage(5);

      // Bulk update
      const ids = Array.from({ length: 20 }, (_, i) => `${i + 1}`);
      actions.bulkUpdate(ids, { done: true });

      const result = pagination.getPage();
      expect(result.page).toBe(5);
      expect(result.totalItems).toBe(100);
    });
  });

  describe('Custom page size', () => {
    it('should respect custom page size of 25', () => {
      const customPagination = arrayPagination(reactor, 'items', {
        pageSize: 25,
      });

      const result = customPagination.getPage();

      expect(result.items).toHaveLength(25);
      expect(result.totalPages).toBe(4);
      expect(result.pageSize).toBe(25);
    });

    it('should respect custom page size of 1', () => {
      const customPagination = arrayPagination(reactor, 'items', {
        pageSize: 1,
      });

      const result = customPagination.getPage();

      expect(result.items).toHaveLength(1);
      expect(result.totalPages).toBe(100);
      expect(result.pageSize).toBe(1);
    });

    it('should respect custom initial page', () => {
      const customPagination = arrayPagination(reactor, 'items', {
        pageSize: 10,
        initialPage: 3,
      });

      const result = customPagination.getPage();

      expect(result.page).toBe(3);
      expect(result.items[0].id).toBe('21');
    });
  });

  describe('Validation', () => {
    it('should throw on invalid pageSize', () => {
      expect(() => {
        arrayPagination(reactor, 'items', { pageSize: 0 });
      }).toThrow(RangeError);

      expect(() => {
        arrayPagination(reactor, 'items', { pageSize: -1 });
      }).toThrow(RangeError);
    });

    it('should throw on invalid initialPage', () => {
      expect(() => {
        arrayPagination(reactor, 'items', { initialPage: 0 });
      }).toThrow(RangeError);

      expect(() => {
        arrayPagination(reactor, 'items', { initialPage: -1 });
      }).toThrow(RangeError);
    });

    it('should throw if field is not an array', () => {
      const badReactor = createReactor({ items: 'not an array' as any });

      expect(() => {
        const p = arrayPagination(badReactor, 'items');
        p.getPage();
      }).toThrow(TypeError);
    });
  });

  describe('arrayActions no longer has pagination', () => {
    it('should not have pagination methods on arrayActions', () => {
      const actionsWithoutPagination = arrayActions(reactor, 'items', {
        idKey: 'id',
      });

      expect((actionsWithoutPagination as any).getPaginated).toBeUndefined();
      expect((actionsWithoutPagination as any).setPage).toBeUndefined();
      expect((actionsWithoutPagination as any).nextPage).toBeUndefined();
      expect((actionsWithoutPagination as any).prevPage).toBeUndefined();
      expect((actionsWithoutPagination as any).firstPage).toBeUndefined();
      expect((actionsWithoutPagination as any).lastPage).toBeUndefined();
    });
  });
});
