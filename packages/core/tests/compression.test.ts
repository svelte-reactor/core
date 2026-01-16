/**
 * Compression Tests (lz-string)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { persist } from '../src/plugins/persist-plugin.js';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

describe('Compression (lz-string)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Basic Compression', () => {
    it('should compress data when compress: true', async () => {
      const reactor = createReactor(
        { message: 'Hello World!', count: 42 },
        {
          plugins: [
            persist({
              key: 'test-compress',
              compress: true
            })
          ]
        }
      );

      // Wait for lz-string to be loaded (lazy import)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger persist
      reactor.update((state) => {
        state.count = 100;
      });

      // Check that data is compressed
      const stored = localStorage.getItem('test-compress');
      expect(stored).not.toBeNull();

      // Compressed data should NOT be valid JSON
      expect(() => JSON.parse(stored!)).toThrow();

      // But should be decompressible
      const decompressed = decompressFromUTF16(stored!);
      expect(decompressed).not.toBeNull();

      const parsed = JSON.parse(decompressed!);
      expect(parsed.count).toBe(100);
    });

    it('should NOT compress data when compress: false', () => {
      const reactor = createReactor(
        { message: 'Hello World!', count: 42 },
        {
          plugins: [
            persist({
              key: 'test-no-compress',
              compress: false
            })
          ]
        }
      );

      // Trigger persist
      reactor.update((state) => {
        state.count = 100;
      });

      // Check that data is NOT compressed
      const stored = localStorage.getItem('test-no-compress');
      expect(stored).not.toBeNull();

      // Uncompressed data should be valid JSON
      expect(() => {
        const parsed = JSON.parse(stored!);
        expect(parsed.count).toBe(100);
      }).not.toThrow();
    });

    it('should restore compressed data correctly', () => {
      // First reactor - save with compression
      const reactor1 = createReactor(
        { value: 0 },
        {
          plugins: [
            persist({
              key: 'test-restore-compressed',
              compress: true
            })
          ]
        }
      );

      reactor1.update((state) => {
        state.value = 999;
      });

      reactor1.destroy();

      // Second reactor - should restore from compressed data
      const reactor2 = createReactor(
        { value: 0 },
        {
          plugins: [
            persist({
              key: 'test-restore-compressed',
              compress: true
            })
          ]
        }
      );

      expect(reactor2.state.value).toBe(999);
    });
  });

  describe('Compression Ratio', () => {
    it('should significantly reduce size for repetitive data', () => {
      const largeData = {
        items: Array(100).fill({ name: 'Item', value: 42, description: 'A test item' })
      };

      const reactor = createReactor(largeData, {
        plugins: [
          persist({
            key: 'test-compression-ratio',
            compress: true
          })
        ]
      });

      // Trigger persist
      reactor.update((state) => {
        state.items.push({ name: 'New', value: 1, description: 'New item' });
      });

      const compressed = localStorage.getItem('test-compression-ratio')!;
      const uncompressed = JSON.stringify(largeData);

      const compressionRatio = compressed.length / uncompressed.length;

      // Should achieve at least 40% compression (ratio < 0.6)
      expect(compressionRatio).toBeLessThan(0.6);
      console.log(`Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
    });

    it('should handle small data efficiently', () => {
      const smallData = { count: 1 };

      const reactor = createReactor(smallData, {
        plugins: [
          persist({
            key: 'test-small-compress',
            compress: true
          })
        ]
      });

      reactor.update((state) => {
        state.count = 2;
      });

      // Should not throw
      const compressed = localStorage.getItem('test-small-compress');
      expect(compressed).not.toBeNull();

      const decompressed = decompressFromUTF16(compressed!);
      const parsed = JSON.parse(decompressed!);
      expect(parsed.count).toBe(2);
    });

    it('should handle large text data well', () => {
      const longText = 'Lorem ipsum dolor sit amet, '.repeat(100);

      const reactor = createReactor(
        { text: '' },
        {
          plugins: [
            persist({
              key: 'test-long-text',
              compress: true
            })
          ]
        }
      );

      // Make a real change
      reactor.update((state) => {
        state.text = longText;
      });

      const compressed = localStorage.getItem('test-long-text');
      expect(compressed).not.toBeNull();

      const uncompressed = JSON.stringify({ text: longText });

      // Repetitive text should compress very well (>60%)
      const ratio = compressed!.length / uncompressed.length;
      expect(ratio).toBeLessThan(0.4); // At least 60% reduction
    });
  });

  describe('Compatibility', () => {
    it('should work with localStorage and memory storage', () => {
      // localStorage
      const local = createReactor({ value: 1 }, {
        plugins: [persist({ key: 'compress-local', storage: 'localStorage', compress: true })]
      });
      local.update((s) => { s.value = 10; });
      expect(localStorage.getItem('compress-local')).not.toBeNull();

      // memory
      const memory = createReactor({ value: 3 }, {
        plugins: [persist({ key: 'compress-memory', storage: 'memory', compress: true })]
      });
      memory.update((s) => { s.value = 30; });
      // Memory storage should work (no errors)
      expect(memory.state.value).toBe(30);
    });

    it('should work with pick option', () => {
      const reactor = createReactor(
        { public: 'visible', private: 'hidden' },
        {
          plugins: [
            persist({
              key: 'compress-pick',
              compress: true,
              pick: ['public']
            })
          ]
        }
      );

      reactor.update((state) => {
        state.public = 'updated';
      });

      const compressed = localStorage.getItem('compress-pick')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.public).toBe('updated');
      expect(parsed.private).toBeUndefined();
    });

    it('should work with omit option', () => {
      const reactor = createReactor(
        { data: 'public', token: 'secret' },
        {
          plugins: [
            persist({
              key: 'compress-omit',
              compress: true,
              omit: ['token']
            })
          ]
        }
      );

      reactor.update((state) => {
        state.data = 'updated';
      });

      const compressed = localStorage.getItem('compress-omit')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.data).toBe('updated');
      expect(parsed.token).toBeUndefined();
    });

    it('should work with TTL', () => {
      const reactor = createReactor(
        { value: 42 },
        {
          plugins: [
            persist({
              key: 'compress-ttl',
              compress: true,
              ttl: 60000 // 1 minute
            })
          ]
        }
      );

      reactor.update((state) => {
        state.value = 100;
      });

      const compressed = localStorage.getItem('compress-ttl')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.value).toBe(100);
      expect(parsed.__timestamp).toBeDefined();
    });

    it('should work with migrations', () => {
      // Save v1 data (compressed)
      const v1 = createReactor(
        { oldField: 'value' },
        {
          plugins: [
            persist({
              key: 'compress-migrate',
              compress: true,
              version: 1
            })
          ]
        }
      );

      v1.update((state) => {
        state.oldField = 'data';
      });

      v1.destroy();

      // Load with v2 migration
      const v2 = createReactor(
        { newField: '' },
        {
          plugins: [
            persist({
              key: 'compress-migrate',
              compress: true,
              version: 2,
              migrations: {
                2: (data: any) => ({
                  newField: data.oldField || 'default'
                })
              }
            })
          ]
        }
      );

      expect(v2.state.newField).toBe('data');
    });
  });

  describe('Edge Cases', () => {
    it('should handle objects becoming empty', () => {
      interface TestState {
        value?: number;
      }

      const reactor = createReactor<TestState>(
        { value: 42 },
        {
          plugins: [
            persist({
              key: 'compress-becomes-empty',
              compress: true
            })
          ]
        }
      );

      // Make it nearly empty
      reactor.update((state) => {
        delete state.value;
      });

      const compressed = localStorage.getItem('compress-becomes-empty');
      expect(compressed).not.toBeNull();

      const decompressed = decompressFromUTF16(compressed!);
      expect(decompressed).not.toBeNull();

      const parsed = JSON.parse(decompressed!);
      expect(parsed.value).toBeUndefined();
    });

    it('should handle nested objects', () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };

      const reactor = createReactor(nested, {
        plugins: [
          persist({
            key: 'compress-nested',
            compress: true
          })
        ]
      });

      reactor.update((state) => {
        state.level1.level2.level3.value = 'updated';
      });

      const compressed = localStorage.getItem('compress-nested')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.level1.level2.level3.value).toBe('updated');
    });

    it('should handle arrays', () => {
      const reactor = createReactor(
        { items: [1, 2, 3, 4, 5] },
        {
          plugins: [
            persist({
              key: 'compress-arrays',
              compress: true
            })
          ]
        }
      );

      reactor.update((state) => {
        state.items.push(6, 7, 8);
      });

      const compressed = localStorage.getItem('compress-arrays')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should handle special characters', () => {
      const special = {
        text: 'Special chars: quotes and slashes',
        unicode: '你好世界 Привіт'
      };

      const reactor = createReactor(special, {
        plugins: [
          persist({
            key: 'compress-special',
            compress: true
          })
        ]
      });

      reactor.update((state) => {
        state.unicode = '🎉 Updated';
      });

      const compressed = localStorage.getItem('compress-special')!;
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);

      expect(parsed.text).toBe(special.text);
      expect(parsed.unicode).toBe('🎉 Updated');
    });

    it('should handle very large objects', () => {
      const large = {
        array: Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}`, value: Math.random() }))
      };

      const reactor = createReactor(large, {
        plugins: [
          persist({
            key: 'compress-large',
            compress: true
          })
        ]
      });

      reactor.update((state) => {
        state.array[0].value = 999;
      });

      const compressed = localStorage.getItem('compress-large')!;
      const uncompressed = JSON.stringify(large);

      // Should compress significantly
      expect(compressed.length).toBeLessThan(uncompressed.length);

      // Should restore correctly
      const decompressed = decompressFromUTF16(compressed);
      const parsed = JSON.parse(decompressed!);
      expect(parsed.array.length).toBe(1000);
    });

    it('should fallback gracefully if decompression fails', () => {
      // Manually set completely invalid data (not JSON, not compressed)
      localStorage.setItem('truly-corrupt', 'this is not json or compressed!!!');

      const reactor = createReactor(
        { value: 'default' },
        {
          plugins: [
            persist({
              key: 'truly-corrupt',
              compress: true
            })
          ]
        }
      );

      // Should use default state (both decompression and JSON parse failed)
      expect(reactor.state.value).toBe('default');
    });

    it('should handle switching compress on/off', () => {
      // Save without compression
      const uncompressed = createReactor(
        { value: 100 },
        {
          plugins: [
            persist({
              key: 'switch-compress',
              compress: false
            })
          ]
        }
      );

      uncompressed.update((state) => {
        state.value = 200;
      });

      uncompressed.destroy();

      // Load with compression enabled - should fallback to direct parse
      const compressed = createReactor(
        { value: 0 },
        {
          plugins: [
            persist({
              key: 'switch-compress',
              compress: true
            })
          ]
        }
      );

      // Should load the data (with fallback)
      expect(compressed.state.value).toBe(200);
    });
  });

  describe('Performance', () => {
    it('should compress/decompress reasonably fast', () => {
      const data = {
        items: Array(100).fill({ name: 'Test', value: 42 })
      };

      const start = performance.now();

      const reactor = createReactor(data, {
        plugins: [
          persist({
            key: 'compress-perf',
            compress: true
          })
        ]
      });

      reactor.update((state) => {
        state.items.push({ name: 'New', value: 1 });
      });

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (<100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
