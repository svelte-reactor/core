/**
 * Array Pagination Helper - Standalone pagination for array fields
 *
 * Extracted from arrayActions in v0.2.9 for cleaner separation of concerns.
 */

import type { Reactor } from '../types/index.js';

/**
 * Pagination configuration options
 */
export interface ArrayPaginationOptions {
  /**
   * Number of items per page
   * @default 20
   */
  pageSize?: number;

  /**
   * Initial page number (1-indexed)
   * @default 1
   */
  initialPage?: number;
}

/**
 * Paginated data result
 */
export interface PaginatedResult<T> {
  /** Current page items */
  items: T[];

  /** Current page number (1-indexed) */
  page: number;

  /** Total number of pages */
  totalPages: number;

  /** Total number of items */
  totalItems: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrev: boolean;

  /** Number of items per page */
  pageSize: number;
}

/**
 * Array pagination interface
 */
export interface ArrayPagination<T> {
  /**
   * Get paginated data
   * @returns Paginated result with current page items and metadata
   */
  getPage(): PaginatedResult<T>;

  /**
   * Set current page
   * @param page Page number (1-indexed)
   */
  setPage(page: number): void;

  /**
   * Go to next page
   * @returns true if successful, false if already on last page
   */
  nextPage(): boolean;

  /**
   * Go to previous page
   * @returns true if successful, false if already on first page
   */
  prevPage(): boolean;

  /**
   * Go to first page
   */
  firstPage(): void;

  /**
   * Go to last page
   */
  lastPage(): void;

  /**
   * Get current page number
   */
  getCurrentPage(): number;

  /**
   * Get total number of pages
   */
  getTotalPages(): number;
}

/**
 * Create pagination helper for an array field in a reactor
 *
 * @example
 * ```typescript
 * const store = createReactor({ items: [] as Item[] });
 * const pagination = arrayPagination(store, 'items', { pageSize: 20 });
 *
 * // Get current page
 * const { items, page, totalPages } = pagination.getPage();
 *
 * // Navigate pages
 * pagination.nextPage();
 * pagination.prevPage();
 * pagination.setPage(3);
 * ```
 */
export function arrayPagination<
  S extends object,
  K extends keyof S,
  T = S[K] extends (infer U)[] ? U : never
>(
  reactor: Reactor<S>,
  field: K,
  options: ArrayPaginationOptions = {}
): ArrayPagination<T> {
  const { pageSize = 20, initialPage = 1 } = options;

  // Validate options
  if (pageSize < 1) {
    throw new RangeError(
      `[arrayPagination] pageSize must be at least 1, got ${pageSize}`
    );
  }

  if (initialPage < 1) {
    throw new RangeError(
      `[arrayPagination] initialPage must be at least 1, got ${initialPage}`
    );
  }

  // Pagination state
  let currentPage = initialPage;

  // Helper to get array from state
  const getArray = (): T[] => {
    const value = reactor.state[field];
    if (!Array.isArray(value)) {
      const actualType = value === null ? 'null' : value === undefined ? 'undefined' : typeof value;
      throw new TypeError(
        `[arrayPagination] Field '${String(field)}' must be an array.\n` +
        `  Current type: ${actualType}\n` +
        `  Current value: ${JSON.stringify(value)}\n\n` +
        `Tip: Initialize your state with an array:\n` +
        `  const store = createReactor({ ${String(field)}: [] });`
      );
    }
    return value as T[];
  };

  return {
    getPage(): PaginatedResult<T> {
      const arr = getArray();
      const totalItems = arr.length;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;

      // Clamp current page to valid range
      currentPage = Math.max(1, Math.min(currentPage, totalPages));

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalItems);
      const items = arr.slice(startIndex, endIndex);

      return {
        items,
        page: currentPage,
        totalPages,
        totalItems,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        pageSize,
      };
    },

    setPage(page: number): void {
      const arr = getArray();
      const totalPages = Math.ceil(arr.length / pageSize) || 1;

      if (page < 1 || page > totalPages) {
        console.warn(`[arrayPagination] Invalid page ${page}. Valid range: 1-${totalPages}`);
        return;
      }

      currentPage = page;
    },

    nextPage(): boolean {
      const arr = getArray();
      const totalPages = Math.ceil(arr.length / pageSize) || 1;

      if (currentPage < totalPages) {
        currentPage++;
        return true;
      }
      return false;
    },

    prevPage(): boolean {
      if (currentPage > 1) {
        currentPage--;
        return true;
      }
      return false;
    },

    firstPage(): void {
      currentPage = 1;
    },

    lastPage(): void {
      const arr = getArray();
      const totalPages = Math.ceil(arr.length / pageSize) || 1;
      currentPage = totalPages;
    },

    getCurrentPage(): number {
      return currentPage;
    },

    getTotalPages(): number {
      const arr = getArray();
      return Math.ceil(arr.length / pageSize) || 1;
    },
  };
}
