/**
 * Memory Storage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage, memoryStorage } from '../src/storage/memory-storage.js';
import { createReactor } from '../src/core/reactor.svelte.js';
import { persist } from '../src/plugins/persist-plugin.js';

describe('MemoryStorage', () => {
  beforeEach(() => {
    // Clear memory storage before each test
    memoryStorage.clear();
  });

  describe('Basic API', () => {
    it('should implement Storage interface', () => {
      const storage = new MemoryStorage();

      expect(storage.getItem).toBeDefined();
      expect(storage.setItem).toBeDefined();
      expect(storage.removeItem).toBeDefined();
      expect(storage.clear).toBeDefined();
      expect(storage.key).toBeDefined();
      expect(typeof storage.length).toBe('number');
    });

    it('should set and get items', () => {
      const storage = new MemoryStorage();

      storage.setItem('test', 'value');
      expect(storage.getItem('test')).toBe('value');
    });

    it('should return null for non-existent keys', () => {
      const storage = new MemoryStorage();

      expect(storage.getItem('non-existent')).toBe(null);
    });

    it('should remove items', () => {
      const storage = new MemoryStorage();

      storage.setItem('test', 'value');
      storage.removeItem('test');
      expect(storage.getItem('test')).toBe(null);
    });

    it('should clear all items', () => {
      const storage = new MemoryStorage();

      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      storage.setItem('key3', 'value3');

      expect(storage.length).toBe(3);

      storage.clear();

      expect(storage.length).toBe(0);
      expect(storage.getItem('key1')).toBe(null);
      expect(storage.getItem('key2')).toBe(null);
      expect(storage.getItem('key3')).toBe(null);
    });

    it('should return correct length', () => {
      const storage = new MemoryStorage();

      expect(storage.length).toBe(0);

      storage.setItem('key1', 'value1');
      expect(storage.length).toBe(1);

      storage.setItem('key2', 'value2');
      expect(storage.length).toBe(2);

      storage.removeItem('key1');
      expect(storage.length).toBe(1);

      storage.clear();
      expect(storage.length).toBe(0);
    });

    it('should return key at index', () => {
      const storage = new MemoryStorage();

      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      storage.setItem('key3', 'value3');

      // Keys can be in any order (Map iteration order)
      const key0 = storage.key(0);
      const key1 = storage.key(1);
      const key2 = storage.key(2);

      expect(['key1', 'key2', 'key3']).toContain(key0);
      expect(['key1', 'key2', 'key3']).toContain(key1);
      expect(['key1', 'key2', 'key3']).toContain(key2);
    });

    it('should return null for invalid index', () => {
      const storage = new MemoryStorage();

      storage.setItem('key1', 'value1');

      expect(storage.key(-1)).toBe(null);
      expect(storage.key(1)).toBe(null);
      expect(storage.key(100)).toBe(null);
    });

    it('should overwrite existing values', () => {
      const storage = new MemoryStorage();

      storage.setItem('key', 'value1');
      expect(storage.getItem('key')).toBe('value1');

      storage.setItem('key', 'value2');
      expect(storage.getItem('key')).toBe('value2');

      // Length should not increase
      expect(storage.length).toBe(1);
    });
  });

  describe('Singleton Behavior', () => {
    it('should share data across instances', () => {
      const storage1 = new MemoryStorage();
      const storage2 = new MemoryStorage();

      storage1.setItem('shared', 'data');
      expect(storage2.getItem('shared')).toBe('data');

      storage2.setItem('shared', 'updated');
      expect(storage1.getItem('shared')).toBe('updated');
    });

    it('should use global memoryStorage instance', () => {
      memoryStorage.setItem('global', 'value');

      const storage = new MemoryStorage();
      expect(storage.getItem('global')).toBe('value');
    });

    it('should clear data for all instances', () => {
      const storage1 = new MemoryStorage();
      const storage2 = new MemoryStorage();

      storage1.setItem('key1', 'value1');
      storage2.setItem('key2', 'value2');

      expect(storage1.length).toBe(2);
      expect(storage2.length).toBe(2);

      storage1.clear();

      expect(storage1.length).toBe(0);
      expect(storage2.length).toBe(0);
      expect(storage1.getItem('key1')).toBe(null);
      expect(storage2.getItem('key2')).toBe(null);
    });
  });

  describe('Integration with persist plugin', () => {
    it('should work with persist plugin', () => {
      interface TestState {
        count: number;
        name: string;
      }

      const reactor = createReactor<TestState>(
        { count: 0, name: 'test' },
        {
          plugins: [
            persist({
              key: 'test-memory',
              storage: 'memory'
            })
          ]
        }
      );

      // Update state (persist only saves after update)
      reactor.update((state) => {
        state.count = 42;
        state.name = 'updated';
      });

      // State should be persisted
      const stored = memoryStorage.getItem('test-memory');
      expect(stored).not.toBeNull();
      expect(stored!).toContain('"count":42');
      expect(stored!).toContain('"name":"updated"');
    });

    it('should restore state from memory storage', () => {
      interface TestState {
        value: number;
      }

      // Pre-populate memory storage
      memoryStorage.setItem('test-restore', JSON.stringify({ value: 999 }));

      const reactor = createReactor<TestState>(
        { value: 0 },
        {
          plugins: [
            persist({
              key: 'test-restore',
              storage: 'memory'
            })
          ]
        }
      );

      // Should restore from memory storage
      expect(reactor.state.value).toBe(999);
    });

    it('should work in SSR environment (no window)', () => {
      // Memory storage doesn't depend on window object
      const storage = new MemoryStorage();

      storage.setItem('ssr-test', 'works');
      expect(storage.getItem('ssr-test')).toBe('works');

      // Should not throw
      expect(() => {
        const reactor = createReactor(
          { data: 'test' },
          {
            plugins: [
              persist({
                key: 'ssr-reactor',
                storage: 'memory'
              })
            ]
          }
        );
        expect(reactor.state.data).toBe('test');
      }).not.toThrow();
    });

    it('should support pick option', () => {
      interface TestState {
        public: string;
        private: string;
      }

      const reactor = createReactor<TestState>(
        { public: 'visible', private: 'hidden' },
        {
          plugins: [
            persist({
              key: 'test-pick',
              storage: 'memory',
              pick: ['public']
            })
          ]
        }
      );

      // Trigger persist by updating with a real change
      reactor.update((state) => {
        state.public = 'visible-updated';
      });

      const stored = memoryStorage.getItem('test-pick');
      expect(stored).not.toBeNull();
      expect(stored!).toContain('"public"');
      expect(stored!).not.toContain('"private"');
    });

    it('should support omit option', () => {
      interface TestState {
        data: string;
        token: string;
      }

      const reactor = createReactor<TestState>(
        { data: 'public', token: 'secret' },
        {
          plugins: [
            persist({
              key: 'test-omit',
              storage: 'memory',
              omit: ['token']
            })
          ]
        }
      );

      // Trigger persist by updating with a real change
      reactor.update((state) => {
        state.data = 'public-updated';
      });

      const stored = memoryStorage.getItem('test-omit');
      expect(stored).not.toBeNull();
      expect(stored!).toContain('"data"');
      expect(stored!).not.toContain('"token"');
    });

    it('should work with complex objects', () => {
      interface ComplexState {
        nested: {
          deep: {
            value: number;
          };
        };
      }

      const reactor = createReactor<ComplexState>(
        { nested: { deep: { value: 0 } } },
        {
          plugins: [
            persist({
              key: 'test-complex',
              storage: 'memory'
            })
          ]
        }
      );

      // Update nested value
      reactor.update((state) => {
        state.nested.deep.value = 123;
      });

      // Should persist correctly
      const stored = memoryStorage.getItem('test-complex');
      expect(stored).not.toBeNull();
      expect(stored!).toContain('"value":123');
    });

    it('should not persist across different keys', () => {
      const reactor1 = createReactor(
        { value: 1 },
        {
          plugins: [persist({ key: 'store1', storage: 'memory' })]
        }
      );

      const reactor2 = createReactor(
        { value: 2 },
        {
          plugins: [persist({ key: 'store2', storage: 'memory' })]
        }
      );

      // Trigger persist by updating with real changes
      reactor1.update((state) => { state.value = 10; });
      reactor2.update((state) => { state.value = 20; });

      expect(reactor1.state.value).toBe(10);
      expect(reactor2.state.value).toBe(20);

      // Storage should have both keys
      expect(memoryStorage.getItem('store1')).not.toBeNull();
      expect(memoryStorage.getItem('store2')).not.toBeNull();
      expect(memoryStorage.getItem('store1')!).toContain('"value":10');
      expect(memoryStorage.getItem('store2')!).toContain('"value":20');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string as value', () => {
      const storage = new MemoryStorage();

      storage.setItem('empty', '');
      expect(storage.getItem('empty')).toBe('');
      expect(storage.length).toBe(1);
    });

    it('should handle special characters in keys', () => {
      const storage = new MemoryStorage();

      const specialKeys = [
        'key.with.dots',
        'key-with-dashes',
        'key_with_underscores',
        'key/with/slashes',
        'key[with]brackets',
        'key@with@symbols'
      ];

      specialKeys.forEach((key) => {
        storage.setItem(key, 'value');
        expect(storage.getItem(key)).toBe('value');
      });
    });

    it('should handle special characters in values', () => {
      const storage = new MemoryStorage();

      const specialValues = [
        'value with spaces',
        'value\nwith\nnewlines',
        'value\twith\ttabs',
        'value"with"quotes',
        "value'with'apostrophes",
        'value\\with\\backslashes'
      ];

      specialValues.forEach((value, index) => {
        storage.setItem(`key${index}`, value);
        expect(storage.getItem(`key${index}`)).toBe(value);
      });
    });

    it('should handle very long values', () => {
      const storage = new MemoryStorage();

      const longValue = 'x'.repeat(1000000); // 1MB string
      storage.setItem('long', longValue);
      expect(storage.getItem('long')).toBe(longValue);
    });

    it('should handle many items', () => {
      const storage = new MemoryStorage();

      const count = 1000;
      for (let i = 0; i < count; i++) {
        storage.setItem(`key${i}`, `value${i}`);
      }

      expect(storage.length).toBe(count);

      for (let i = 0; i < count; i++) {
        expect(storage.getItem(`key${i}`)).toBe(`value${i}`);
      }
    });
  });
});
