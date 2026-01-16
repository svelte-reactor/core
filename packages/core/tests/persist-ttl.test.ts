/**
 * TTL (Time-To-Live) Tests for persist plugin
 * Testing automatic expiration of cached data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { persist } from '../src/plugins/persist-plugin.js';

describe('Persist Plugin - TTL Support', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllTimers();
  });

  describe('Basic TTL functionality', () => {
    it('should store data with timestamp when TTL is enabled', () => {
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-test',
            ttl: 5000 // 5 seconds
          })
        ]
      });

      reactor.update(state => {
        state.count = 42;
      });

      // Check that timestamp is stored
      const stored = localStorage.getItem('ttl-test');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.__timestamp).toBeDefined();
      expect(typeof parsed.__timestamp).toBe('number');
      expect(parsed.__timestamp).toBeGreaterThan(0);

      reactor.destroy();
    });

    it('should load data that has not expired', () => {
      // First reactor - save data
      const reactor1 = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-not-expired',
            ttl: 10000 // 10 seconds
          })
        ]
      });

      reactor1.update(state => {
        state.count = 42;
      });
      reactor1.destroy();

      // Second reactor - should load data (not expired)
      const reactor2 = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-not-expired',
            ttl: 10000
          })
        ]
      });

      expect(reactor2.state.count).toBe(42);
      reactor2.destroy();
    });

    it('should NOT load data that has expired', () => {
      // First reactor - save data with timestamp
      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000 // 10 seconds ago
      };

      localStorage.setItem('ttl-expired', JSON.stringify(expiredData));

      // Second reactor - should NOT load expired data
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-expired',
            ttl: 5000 // 5 seconds TTL
          })
        ]
      });

      // Should use initial state, not expired data
      expect(reactor.state.count).toBe(0);

      reactor.destroy();
    });

    it('should remove expired data from storage', () => {
      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000 // 10 seconds ago
      };

      localStorage.setItem('ttl-remove', JSON.stringify(expiredData));

      // Load with reactor - should remove expired data
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-remove',
            ttl: 5000 // 5 seconds TTL
          })
        ]
      });

      // Expired data should be removed
      const stored = localStorage.getItem('ttl-remove');
      expect(stored).toBeNull();

      reactor.destroy();
    });
  });

  describe('onExpire callback', () => {
    it('should call onExpire when data expires', () => {
      const onExpire = vi.fn();

      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000
      };

      localStorage.setItem('ttl-callback', JSON.stringify(expiredData));

      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-callback',
            ttl: 5000,
            onExpire
          })
        ]
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(onExpire).toHaveBeenCalledWith('ttl-callback');

      reactor.destroy();
    });

    it('should handle onExpire errors gracefully', () => {
      const onExpire = vi.fn(() => {
        throw new Error('Callback error');
      });

      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000
      };

      localStorage.setItem('ttl-error', JSON.stringify(expiredData));

      // Should not throw, just log error
      expect(() => {
        const reactor = createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'ttl-error',
              ttl: 5000,
              onExpire
            })
          ]
        });
        reactor.destroy();
      }).not.toThrow();

      expect(onExpire).toHaveBeenCalled();
    });

    it('should work without onExpire callback', () => {
      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000
      };

      localStorage.setItem('ttl-no-callback', JSON.stringify(expiredData));

      // Should work fine without callback
      expect(() => {
        const reactor = createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'ttl-no-callback',
              ttl: 5000
              // No onExpire
            })
          ]
        });
        reactor.destroy();
      }).not.toThrow();
    });
  });

  describe('TTL with other features', () => {
    it('should work with version migrations', () => {
      const now = Date.now();
      const expiredData = {
        oldField: 'old',
        __timestamp: now - 10000,
        __version: 1
      };

      localStorage.setItem('ttl-migration', JSON.stringify(expiredData));

      const reactor = createReactor({ newField: 'default' }, {
        plugins: [
          persist({
            key: 'ttl-migration',
            ttl: 5000,
            version: 2,
            migrations: {
              2: (data: any) => ({ newField: data.oldField || 'migrated' })
            }
          })
        ]
      });

      // Expired data should not be loaded, even with migrations
      expect(reactor.state.newField).toBe('default');

      reactor.destroy();
    });

    it('should work with pick/omit', () => {
      const reactor = createReactor({
        user: { name: 'John', token: 'secret' },
        settings: { theme: 'dark' }
      }, {
        plugins: [
          persist({
            key: 'ttl-pick-omit',
            ttl: 10000,
            omit: ['user.token']
          })
        ]
      });

      reactor.update(state => {
        state.user = { name: 'Jane', token: 'secret123' };
        state.settings = { theme: 'light' };
      });

      reactor.destroy();

      // Load in new reactor
      const reactor2 = createReactor({
        user: { name: '', token: '' },
        settings: { theme: 'dark' }
      }, {
        plugins: [
          persist({
            key: 'ttl-pick-omit',
            ttl: 10000,
            omit: ['user.token']
          })
        ]
      });

      expect(reactor2.state.user.name).toBe('Jane');
      expect(reactor2.state.user.token).toBeUndefined(); // Not persisted (shallow merge)
      expect(reactor2.state.settings.theme).toBe('light');

      reactor2.destroy();
    });

    it('should work with sessionStorage', () => {
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-session',
            storage: 'sessionStorage',
            ttl: 5000
          })
        ]
      });

      reactor.update(state => {
        state.count = 100;
      });

      // Check sessionStorage
      const stored = sessionStorage.getItem('ttl-session');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.__timestamp).toBeDefined();

      reactor.destroy();
    });
  });

  describe('TTL validation', () => {
    it('should throw error for invalid TTL (negative)', () => {
      expect(() => {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'invalid-ttl',
              ttl: -1000 // Negative TTL
            })
          ]
        });
      }).toThrow(/ttl must be a non-negative number/);
    });

    it('should throw error for invalid TTL (not a number)', () => {
      expect(() => {
        createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'invalid-ttl',
              // @ts-expect-error - Testing runtime validation
              ttl: 'invalid'
            })
          ]
        });
      }).toThrow(/ttl must be a non-negative number/);
    });

    it('should work with TTL = 0 (immediate expiration)', async () => {
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-zero',
            ttl: 0 // Expires immediately
          })
        ]
      });

      reactor.update(state => {
        state.count = 42;
      });
      reactor.destroy();

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Load in new reactor - should expire immediately
      const reactor2 = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-zero',
            ttl: 0
          })
        ]
      });

      // Data should be expired
      expect(reactor2.state.count).toBe(0);

      reactor2.destroy();
    });
  });

  describe('Edge cases', () => {
    it('should handle data without timestamp gracefully', () => {
      // Store data without timestamp
      const dataWithoutTimestamp = { count: 42 };
      localStorage.setItem('ttl-no-timestamp', JSON.stringify(dataWithoutTimestamp));

      // Should load normally (no timestamp = not expired)
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'ttl-no-timestamp',
            ttl: 5000
          })
        ]
      });

      expect(reactor.state.count).toBe(42);

      reactor.destroy();
    });

    it('should handle corrupted timestamp', () => {
      const corruptedData = {
        count: 42,
        __timestamp: 'not-a-number'
      };

      localStorage.setItem('ttl-corrupted', JSON.stringify(corruptedData));

      // Should handle gracefully
      expect(() => {
        const reactor = createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'ttl-corrupted',
              ttl: 5000
            })
          ]
        });
        reactor.destroy();
      }).not.toThrow();
    });

    it('should not add timestamp when TTL is not set', () => {
      const reactor = createReactor({ count: 0 }, {
        plugins: [
          persist({
            key: 'no-ttl'
            // No TTL
          })
        ]
      });

      reactor.update(state => {
        state.count = 42;
      });

      const stored = localStorage.getItem('no-ttl');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.__timestamp).toBeUndefined();

      reactor.destroy();
    });

    it('should handle removal errors gracefully', () => {
      const now = Date.now();
      const expiredData = {
        count: 42,
        __timestamp: now - 10000
      };

      localStorage.setItem('ttl-remove-error', JSON.stringify(expiredData));

      // Mock removeItem to throw
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('Remove failed');
      });

      // Should not throw, just log error
      expect(() => {
        const reactor = createReactor({ count: 0 }, {
          plugins: [
            persist({
              key: 'ttl-remove-error',
              ttl: 5000
            })
          ]
        });
        reactor.destroy();
      }).not.toThrow();

      // Restore original
      Storage.prototype.removeItem = originalRemoveItem;
    });
  });

  describe('Real-world scenarios', () => {
    it('should work for cache with 5-minute expiration', () => {
      const FIVE_MINUTES = 5 * 60 * 1000;

      const reactor = createReactor({ data: null as any }, {
        plugins: [
          persist({
            key: 'api-cache',
            ttl: FIVE_MINUTES,
            onExpire: (key) => {
              console.log(`Cache expired: ${key}`);
            }
          })
        ]
      });

      // Simulate API response
      reactor.update(state => {
        state.data = { users: ['Alice', 'Bob'], timestamp: Date.now() };
      });

      // Verify stored
      const stored = localStorage.getItem('api-cache');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.__timestamp).toBeDefined();

      reactor.destroy();

      // Reload immediately - should work
      const reactor2 = createReactor({ data: null as any }, {
        plugins: [
          persist({
            key: 'api-cache',
            ttl: FIVE_MINUTES
          })
        ]
      });

      expect(reactor2.state.data).toBeTruthy();
      expect(reactor2.state.data.users).toEqual(['Alice', 'Bob']);

      reactor2.destroy();
    });

    it('should work for session data with 30-minute expiration', () => {
      const THIRTY_MINUTES = 30 * 60 * 1000;

      const reactor = createReactor({
        sessionId: '',
        user: { id: 0, name: '' }
      }, {
        plugins: [
          persist({
            key: 'user-session',
            storage: 'sessionStorage',
            ttl: THIRTY_MINUTES,
            onExpire: () => {
              // Redirect to login
              console.log('Session expired, please log in again');
            }
          })
        ]
      });

      reactor.update(state => {
        state.sessionId = 'abc123';
        state.user = { id: 1, name: 'John' };
      });

      expect(reactor.state.sessionId).toBe('abc123');

      reactor.destroy();
    });
  });
});
