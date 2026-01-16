/**
 * Storage Type Safety Tests
 * Testing TypeScript type checking and runtime validation for storage parameter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { persistedStore, type StorageType } from '../src/index.js';
import { createReactor } from '../src/core/reactor.svelte.js';
import { persist } from '../src/plugins/persist-plugin.js';

describe('Storage Type Safety', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('TypeScript Types', () => {
    it('should export StorageType', () => {
      // This test verifies that StorageType is exported
      const validTypes: StorageType[] = [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'memory'
      ];

      expect(validTypes.length).toBe(4);
    });

    it('should accept all valid storage types in persistedStore', () => {
      // localStorage (default)
      expect(() => {
        persistedStore('test-local', { data: 1 });
      }).not.toThrow();

      // Explicit localStorage
      expect(() => {
        persistedStore('test-local-explicit', { data: 2 }, {
          storage: 'localStorage'
        });
      }).not.toThrow();

      // sessionStorage
      expect(() => {
        persistedStore('test-session', { data: 3 }, {
          storage: 'sessionStorage'
        });
      }).not.toThrow();

      // memory
      expect(() => {
        persistedStore('test-memory', { data: 4 }, {
          storage: 'memory'
        });
      }).not.toThrow();
    });
  });

  describe('Runtime Validation', () => {
    it('should throw error for invalid storage type in persist plugin', () => {
      expect(() => {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'test',
              // @ts-expect-error - Testing runtime validation
              storage: 'redis'
            })
          ]
        });
      }).toThrow(/Invalid storage type/);
    });

    it('should throw error with helpful message', () => {
      try {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'test',
              // @ts-expect-error - Testing runtime validation
              storage: 'invalidStorage'
            })
          ]
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid storage type: "invalidStorage"');
        expect(error.message).toContain('localStorage');
        expect(error.message).toContain('sessionStorage');
        expect(error.message).toContain('indexedDB');
        expect(error.message).toContain('memory');
      }
    });

    it('should throw error for typos in storage name', () => {
      const typos = [
        'localstorage',  // lowercase
        'LocalStorage',  // capital
        'local-storage', // with dash
        'sessionstorage',
        'indexDB',       // missing 'ed'
        'indexdb',       // lowercase
      ];

      typos.forEach(typo => {
        expect(() => {
          createReactor({ count: 0 }, {
            plugins: [
              persist({
                key: 'test',
                // @ts-expect-error - Testing runtime validation
                storage: typo
              })
            ]
          });
        }).toThrow(/Invalid storage type/);
      });
    });

    it('should handle undefined storage (should default to localStorage)', () => {
      expect(() => {
        const store = persistedStore('test-undefined', { value: 42 }, {
          storage: undefined // Explicitly undefined
        });

        store.set({ value: 100 });

        // Should use localStorage
        const stored = localStorage.getItem('test-undefined');
        expect(stored).toBeTruthy();
      }).not.toThrow();
    });
  });

  describe('Different Storage Types', () => {
    it('should correctly use localStorage', () => {
      const store = persistedStore('test-ls', { count: 0 }, {
        storage: 'localStorage'
      });

      store.set({ count: 42 });

      const stored = localStorage.getItem('test-ls');
      expect(stored).toBeTruthy();

      // persistedStore wraps value in { value: ... }
      const parsed = JSON.parse(stored!);
      expect(parsed.value.count).toBe(42);

      // sessionStorage should be empty
      expect(sessionStorage.getItem('test-ls')).toBeNull();
    });

    it('should correctly use sessionStorage', () => {
      const store = persistedStore('test-ss', { count: 0 }, {
        storage: 'sessionStorage'
      });

      store.set({ count: 99 });

      const stored = sessionStorage.getItem('test-ss');
      expect(stored).toBeTruthy();

      // persistedStore wraps value in { value: ... }
      const parsed = JSON.parse(stored!);
      expect(parsed.value.count).toBe(99);

      // localStorage should be empty
      expect(localStorage.getItem('test-ss')).toBeNull();
    });

    it('should handle memory storage (no persistence)', () => {
      const store = persistedStore('test-memory', { count: 0 }, {
        storage: 'memory'
      });

      store.set({ count: 77 });

      // Should not persist to localStorage or sessionStorage
      expect(localStorage.getItem('test-memory')).toBeNull();
      expect(sessionStorage.getItem('test-memory')).toBeNull();

      // Store should still work
      expect(store.get()).toEqual({ count: 77 });
    });

    it('should allow switching storage types between instances', () => {
      // First instance with localStorage
      const store1 = persistedStore('switch-test', { value: 1 }, {
        storage: 'localStorage'
      });
      store1.set({ value: 100 });

      // Second instance with sessionStorage
      const store2 = persistedStore('switch-test', { value: 2 }, {
        storage: 'sessionStorage'
      });
      store2.set({ value: 200 });

      // Both should have different values
      expect(localStorage.getItem('switch-test')).toContain('100');
      expect(sessionStorage.getItem('switch-test')).toContain('200');
    });
  });

  describe('Type Safety in Real-World Scenarios', () => {
    it('should provide autocomplete for storage types', () => {
      // This test documents the expected developer experience
      // In an IDE, typing storage: ' should show autocomplete for:
      // - 'localStorage'
      // - 'sessionStorage'
      // - 'indexedDB'
      // - 'memory'

      const configs: Array<{ storage: StorageType }> = [
        { storage: 'localStorage' },
        { storage: 'sessionStorage' },
        { storage: 'indexedDB' },
        { storage: 'memory' }
      ];

      expect(configs.length).toBe(4);
    });

    it('should work with const assertions', () => {
      const config = {
        storage: 'localStorage' as const
      };

      expect(() => {
        persistedStore('const-test', { data: 1 }, config);
      }).not.toThrow();
    });

    it('should work with dynamic storage selection', () => {
      const isProduction = false;
      const storage: StorageType = isProduction ? 'indexedDB' : 'memory';

      expect(() => {
        persistedStore('dynamic-test', { data: 1 }, { storage });
      }).not.toThrow();
    });
  });

  describe('Error Messages', () => {
    it('should have clear error message for null storage', () => {
      try {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'test',
              // @ts-expect-error - Testing runtime validation
              storage: null
            })
          ]
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid storage type');
      }
    });

    it('should have clear error message for number storage', () => {
      try {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'test',
              // @ts-expect-error - Testing runtime validation
              storage: 123
            })
          ]
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid storage type');
      }
    });

    it('should have clear error message for object storage', () => {
      try {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'test',
              // @ts-expect-error - Testing runtime validation
              storage: { type: 'localStorage' }
            })
          ]
        });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid storage type');
      }
    });
  });
});
