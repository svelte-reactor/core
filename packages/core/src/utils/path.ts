/**
 * Utility functions for working with object paths
 */

import { smartClone } from './clone.js';

/**
 * Get value at path in object
 * @example getPath({ a: { b: { c: 1 } } }, 'a.b.c') // 1
 */
export function getPath(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Set value at path in object (mutates object)
 * @example setPath({}, 'a.b.c', 1) // { a: { b: { c: 1 } } }
 */
export function setPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * Delete path from object (mutates object)
 * @example deletePath({ a: { b: { c: 1 } } }, 'a.b.c') // { a: { b: {} } }
 */
export function deletePath(obj: any, path: string): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current)) {
      return;
    }
    current = current[key];
  }

  delete current[lastKey];
}

/**
 * Pick specific paths from object
 * @example pick({ a: 1, b: { c: 2, d: 3 } }, ['a', 'b.c']) // { a: 1, b: { c: 2 } }
 */
export function pick(obj: any, paths: string[]): any {
  const result: any = {};

  for (const path of paths) {
    const value = getPath(obj, path);
    if (value !== undefined) {
      setPath(result, path, value);
    }
  }

  return result;
}

/**
 * Omit specific paths from object
 * @example omit({ a: 1, b: { c: 2, d: 3 } }, ['b.c']) // { a: 1, b: { d: 3 } }
 */
export function omit(obj: any, paths: string[]): any {
  // Use smartClone for better performance (3-5x faster than JSON.parse/stringify)
  const result = smartClone(obj);

  for (const path of paths) {
    deletePath(result, path);
  }

  return result;
}
