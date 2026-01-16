/**
 * Tests for Custom Plugin Examples
 *
 * Testing all example plugins from PLUGINS.md guide
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { persist } from '../src/plugins/persist-plugin.js';
import { validation } from '../examples/custom-plugins/validation-plugin.js';
import { analytics } from '../examples/custom-plugins/analytics-plugin.js';
import { snapshot } from '../examples/custom-plugins/snapshot-plugin.js';
import { encryption, simpleEncryption } from '../examples/custom-plugins/encryption-plugin.js';

describe('Plugin Examples', () => {
  describe('Validation Plugin', () => {
    it('should validate state before update', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            validation({
              validate: (state) => state.value >= 0 || 'Value must be positive',
            }),
          ],
        }
      );

      // Valid update
      store.update((s) => {
        s.value = 10;
      });

      expect(store.state.value).toBe(10);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Invalid update - logs error but still updates
      store.update((s) => {
        s.value = -5;
      });

      // State WILL change (validation doesn't prevent updates)
      expect(store.state.value).toBe(-5);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should allow custom error messages', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            validation({
              validate: (state) => state.value >= 0,
              errorMessage: 'Custom error message',
            }),
          ],
        }
      );

      store.update((s) => {
        s.value = -1;
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Custom error message'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });

    it('should not throw when throwOnError is false', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            validation({
              validate: (state) => state.value >= 0 || 'Must be positive',
              throwOnError: false,
            }),
          ],
        }
      );

      expect(() => {
        store.update((s) => {
          s.value = -5;
        });
      }).not.toThrow();

      // Should still update (validation only warns)
      expect(store.state.value).toBe(-5);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should validate complex state', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      interface UserState {
        name: string;
        age: number;
        email: string;
      }

      const store = createReactor<UserState>(
        { name: '', age: 0, email: '' },
        {
          plugins: [
            validation({
              validate: (state) => {
                if (!state.name) return 'Name is required';
                if (state.age < 0) return 'Age must be positive';
                if (!state.email.includes('@')) return 'Invalid email';
                return true;
              },
            }),
          ],
        }
      );

      // Valid update
      store.update((s) => {
        s.name = 'Alice';
        s.age = 25;
        s.email = 'alice@example.com';
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Invalid email - logs error
      store.update((s) => {
        s.email = 'invalid';
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid email'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Analytics Plugin', () => {
    it('should track state changes', () => {
      const trackSpy = vi.fn();

      const store = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [
            analytics({
              track: trackSpy,
              debounce: 0,
            }),
          ],
        }
      );

      store.update((s) => {
        s.count = 42;
      }, 'increment');

      expect(trackSpy).toHaveBeenCalledWith(
        'state_changed',
        expect.objectContaining({
          reactor: 'counter',
          action: 'increment',
          changes: { count: { from: 0, to: 42 } },
        })
      );
    });

    it('should debounce tracking events', async () => {
      const trackSpy = vi.fn();

      const store = createReactor(
        { count: 0 },
        {
          plugins: [
            analytics({
              track: trackSpy,
              debounce: 50,
            }),
          ],
        }
      );

      // Rapid updates
      store.update((s) => {
        s.count = 1;
      });
      store.update((s) => {
        s.count = 2;
      });
      store.update((s) => {
        s.count = 3;
      });

      // Should not have tracked yet
      expect(trackSpy).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should track only once with final value
      expect(trackSpy).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith(
        'state_changed',
        expect.objectContaining({
          changes: { count: { from: 2, to: 3 } },
        })
      );
    });

    it('should filter actions', () => {
      const trackSpy = vi.fn();

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            analytics({
              track: trackSpy,
              debounce: 0,
              filter: (action) => action?.startsWith('user:') || false,
            }),
          ],
        }
      );

      // Should not track (no 'user:' prefix)
      store.update((s) => {
        s.value = 1;
      }, 'temp:update');
      expect(trackSpy).not.toHaveBeenCalled();

      // Should track
      store.update((s) => {
        s.value = 2;
      }, 'user:update');
      expect(trackSpy).toHaveBeenCalled();
    });

    it('should cleanup on destroy', () => {
      const trackSpy = vi.fn();

      const store = createReactor(
        { count: 0 },
        {
          plugins: [
            analytics({
              track: trackSpy,
              debounce: 100,
            }),
          ],
        }
      );

      store.update((s) => {
        s.count = 1;
      });

      // Destroy before debounce completes
      store.destroy();

      // Wait
      setTimeout(() => {
        // Should not track (timer was cleared)
        expect(trackSpy).not.toHaveBeenCalled();
      }, 150);
    });
  });

  describe('Snapshot Plugin', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create initial snapshot', () => {
      const onSnapshotSpy = vi.fn();

      createReactor(
        { content: 'initial' },
        {
          plugins: [
            snapshot({
              interval: 1000,
              onSnapshot: onSnapshotSpy,
            }),
          ],
        }
      );

      // Initial snapshot should be created
      expect(onSnapshotSpy).toHaveBeenCalledTimes(1);
      expect(onSnapshotSpy).toHaveBeenCalledWith(
        { content: 'initial' },
        0 // index
      );
    });

    it('should create periodic snapshots', () => {
      const onSnapshotSpy = vi.fn();

      const store = createReactor(
        { content: 'test' },
        {
          plugins: [
            snapshot({
              interval: 1000,
              onSnapshot: onSnapshotSpy,
            }),
          ],
        }
      );

      // Initial snapshot
      expect(onSnapshotSpy).toHaveBeenCalledTimes(1);

      // Make some updates
      store.update((s) => {
        s.content = 'update 1';
      });
      store.update((s) => {
        s.content = 'update 2';
      });

      // Advance time
      vi.advanceTimersByTime(1000);
      expect(onSnapshotSpy).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000);
      expect(onSnapshotSpy).toHaveBeenCalledTimes(3);
    });

    it('should respect maxSnapshots limit', () => {
      const snapshots: any[] = [];

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            snapshot({
              interval: 100,
              maxSnapshots: 3,
              onSnapshot: (snap) => snapshots.push(snap),
            }),
          ],
        }
      );

      // Create many snapshots
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
      }

      // Should have max 3 snapshots (oldest are removed)
      expect(snapshots.length).toBeGreaterThan(3);
    });

    it('should cleanup on destroy', () => {
      const onSnapshotSpy = vi.fn();

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            snapshot({
              interval: 1000,
              onSnapshot: onSnapshotSpy,
            }),
          ],
        }
      );

      expect(onSnapshotSpy).toHaveBeenCalledTimes(1);

      store.destroy();

      // Advance time - should not create more snapshots
      vi.advanceTimersByTime(5000);
      expect(onSnapshotSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Encryption Plugin', () => {
    it('should log encryption intentions', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const store = createReactor(
        { username: '', password: '' },
        {
          plugins: [
            encryption({
              fields: ['password'],
              encrypt: simpleEncryption.encrypt,
              decrypt: simpleEncryption.decrypt,
            }),
          ],
        }
      );

      store.update((s) => {
        s.username = 'alice';
        s.password = 'secret123';
      });

      // Should log that password would be encrypted
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would encrypt field: password')
      );

      // State is NOT encrypted (this is a demo plugin)
      expect(store.state.password).toBe('secret123');
      expect(store.state.username).toBe('alice');

      consoleLogSpy.mockRestore();
    });

    it('should decrypt on initialization', () => {
      // Test decryption of encrypted data
      const store = createReactor(
        { password: 'encrypted:' + simpleEncryption.encrypt('mysecret') },
        {
          plugins: [
            encryption({
              fields: ['password'],
              encrypt: simpleEncryption.encrypt,
              decrypt: simpleEncryption.decrypt,
            }),
          ],
        }
      );

      // Should be decrypted on init
      expect(store.state.password).toBe('mysecret');
    });

    it('should handle decryption errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = createReactor(
        { password: 'encrypted:invalid-data' },
        {
          plugins: [
            encryption({
              fields: ['password'],
              encrypt: simpleEncryption.encrypt,
              decrypt: simpleEncryption.decrypt,
            }),
          ],
        }
      );

      // Should not crash
      expect(store.state).toBeDefined();

      // Should log error
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log only for changed fields', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const store = createReactor(
        { field1: 'value1', field2: 'value2' },
        {
          plugins: [
            encryption({
              fields: ['field1', 'field2'],
              encrypt: simpleEncryption.encrypt,
              decrypt: simpleEncryption.decrypt,
            }),
          ],
        }
      );

      consoleLogSpy.mockClear();

      // Update only field1
      store.update((s) => {
        s.field1 = 'new-value';
      });

      // Should log only for field1
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would encrypt field: field1')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Plugin Integration', () => {
    it('should work with validation + persist', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = createReactor(
        { count: 0 },
        {
          plugins: [
            validation({
              validate: (s) => s.count >= 0 || 'Count must be positive',
            }),
            persist({
              key: 'validated-store',
              storage: 'memory',
            }),
          ],
        }
      );

      // Valid update
      store.update((s) => {
        s.count = 5;
      });
      expect(store.state.count).toBe(5);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Invalid update - logs error but still persists (validation doesn't prevent)
      store.update((s) => {
        s.count = -1;
      });

      expect(store.state.count).toBe(-1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should work with analytics + validation', () => {
      const trackSpy = vi.fn();

      const store = createReactor(
        { value: 0 },
        {
          plugins: [
            validation({
              validate: (s) => s.value <= 100 || 'Max value is 100',
              throwOnError: false,
            }),
            analytics({
              track: trackSpy,
              debounce: 0,
            }),
          ],
        }
      );

      // Valid update
      store.update((s) => {
        s.value = 50;
      });
      expect(trackSpy).toHaveBeenCalled();

      trackSpy.mockClear();

      // Invalid update (still updates and tracks with throwOnError: false)
      store.update((s) => {
        s.value = 200;
      });
      expect(trackSpy).toHaveBeenCalled();
    });
  });
});
