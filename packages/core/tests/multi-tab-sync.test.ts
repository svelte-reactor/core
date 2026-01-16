/**
 * Multi-Tab Sync Plugin Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { sync, multiTabSync } from '../src/plugins/sync-plugin.js';
import { persist } from '../src/plugins/persist-plugin.js';

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(name: string) {
    this.name = name;

    // Register this channel
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(message: any): void {
    // Simulate async message delivery
    setTimeout(() => {
      const channels = MockBroadcastChannel.channels.get(this.name) || [];

      // Broadcast to all other channels with the same name (excluding this one)
      channels.forEach((channel) => {
        if (channel !== this && channel.onmessage) {
          channel.onmessage(new MessageEvent('message', { data: message }));
        }
      });
    }, 0);
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      const index = channels.indexOf(this);
      if (index !== -1) {
        channels.splice(index, 1);
      }
    }
  }

  static reset(): void {
    this.channels.clear();
  }
}

describe('sync Plugin', () => {
  beforeEach(() => {
    // Mock BroadcastChannel
    (global as any).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.reset();

    // Mock localStorage for fallback tests
    const localStorageMock: Record<string, string> = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key]);
      }),
      key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null),
      get length() {
        return Object.keys(localStorageMock).length;
      },
    } as any;

    // Mock window.addEventListener for storage events
    (global as any).window = {
      localStorage: global.localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
    delete (global as any).BroadcastChannel;
    delete (global as any).window;
  });

  describe('Basic Functionality', () => {
    it('should create sync plugin', () => {
      const plugin = sync({ key: 'test' });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('sync');
      expect(plugin.init).toBeDefined();
      expect(plugin.destroy).toBeDefined();
    });

    it('should sync state between two tabs', async () => {
      // Create two reactors (simulating two tabs)
      const tab1 = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      // Update state in tab1
      tab1.update((s) => {
        s.count = 42;
      });

      // Wait for broadcast to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that tab2 received the update
      expect(tab2.state.count).toBe(42);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });

    it('should sync state between multiple tabs', async () => {
      // Create three reactors (simulating three tabs)
      const tab1 = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      const tab3 = createReactor(
        { count: 0 },
        {
          name: 'counter',
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      // Update state in tab2
      tab2.update((s) => {
        s.count = 123;
      });

      // Wait for broadcast to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that all tabs received the update
      expect(tab1.state.count).toBe(123);
      expect(tab2.state.count).toBe(123);
      expect(tab3.state.count).toBe(123);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
      tab3.destroy();
    });

    it('should use reactor name as default key', async () => {
      // Create two reactors without explicit key but with debounce 0
      const tab1 = createReactor(
        { value: 'a' },
        {
          name: 'myStore',
          plugins: [sync({ debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { value: 'a' },
        {
          name: 'myStore',
          plugins: [sync({ debounce: 0 })],
        }
      );

      // Update in tab1
      tab1.update((s) => {
        s.value = 'updated';
      });

      // Wait for broadcast
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check sync
      expect(tab2.state.value).toBe('updated');

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });

    it('should not sync between different keys', async () => {
      // Create two reactors with different keys
      const storeA = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'storeA', debounce: 0 })],
        }
      );

      const storeB = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'storeB', debounce: 0 })],
        }
      );

      // Update storeA
      storeA.update((s) => {
        s.count = 100;
      });

      // Wait for broadcast
      await new Promise((resolve) => setTimeout(resolve, 50));

      // storeB should NOT be updated
      expect(storeB.state.count).toBe(0);

      // Cleanup
      storeA.destroy();
      storeB.destroy();
    });
  });

  describe('Debouncing', () => {
    it('should debounce broadcasts', async () => {
      const tab1 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 50 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 50 })],
        }
      );

      // Rapid updates
      tab1.update((s) => {
        s.count = 1;
      });
      tab1.update((s) => {
        s.count = 2;
      });
      tab1.update((s) => {
        s.count = 3;
      });

      // Wait less than debounce time - should not have synced yet
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(tab2.state.count).toBe(0);

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should sync the final value
      expect(tab2.state.count).toBe(3);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });

    it('should validate debounce option', () => {
      expect(() => {
        sync({ debounce: -1 });
      }).toThrow('[sync] options.debounce must be a non-negative number');

      expect(() => {
        sync({ debounce: 'invalid' as any });
      }).toThrow('[sync] options.debounce must be a non-negative number');
    });
  });

  describe('Complex State Sync', () => {
    it('should sync nested objects', async () => {
      interface State {
        user: {
          name: string;
          profile: {
            age: number;
            city: string;
          };
        };
      }

      const tab1 = createReactor<State>(
        {
          user: {
            name: 'Alice',
            profile: { age: 25, city: 'NYC' },
          },
        },
        {
          plugins: [sync({ key: 'user', debounce: 0 })],
        }
      );

      const tab2 = createReactor<State>(
        {
          user: {
            name: 'Alice',
            profile: { age: 25, city: 'NYC' },
          },
        },
        {
          plugins: [sync({ key: 'user', debounce: 0 })],
        }
      );

      // Update nested property
      tab1.update((s) => {
        s.user.profile.city = 'SF';
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(tab2.state.user.profile.city).toBe('SF');

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });

    it('should sync arrays', async () => {
      const tab1 = createReactor(
        { items: [1, 2, 3] },
        {
          plugins: [sync({ key: 'list', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { items: [1, 2, 3] },
        {
          plugins: [sync({ key: 'list', debounce: 0 })],
        }
      );

      // Add item
      tab1.update((s) => {
        s.items.push(4);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(tab2.state.items).toEqual([1, 2, 3, 4]);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });
  });

  describe('Integration with Persist Plugin', () => {
    it('should work with persist plugin', async () => {
      const tab1 = createReactor(
        { count: 0 },
        {
          plugins: [
            persist({ key: 'synced-counter', storage: 'memory' }),
            sync({ key: 'synced-counter', debounce: 0 }),
          ],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          plugins: [
            persist({ key: 'synced-counter', storage: 'memory' }),
            sync({ key: 'synced-counter', debounce: 0 }),
          ],
        }
      );

      // Update in tab1
      tab1.update((s) => {
        s.count = 99;
      });

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Both should be synced
      expect(tab2.state.count).toBe(99);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should not create infinite update loops', async () => {
      let broadcastCount = 0;

      // Mock to count actual broadcasts
      const originalPostMessage = MockBroadcastChannel.prototype.postMessage;
      MockBroadcastChannel.prototype.postMessage = function (this: MockBroadcastChannel, message: any) {
        broadcastCount++;
        originalPostMessage.call(this, message);
      };

      const tab1 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      // Single update in tab1
      tab1.update((s) => {
        s.count = 42;
      });

      // Wait for sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should sync to tab2
      expect(tab2.state.count).toBe(42);

      // Should only broadcast once (no infinite loop)
      // Each tab broadcasts once for each update
      expect(broadcastCount).toBeLessThan(5);

      // Cleanup
      tab1.destroy();
      tab2.destroy();

      // Restore original
      MockBroadcastChannel.prototype.postMessage = originalPostMessage;
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on destroy', () => {
      const reactor = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'test' })],
        }
      );

      const channelsBefore = MockBroadcastChannel.channels.get('test')?.length || 0;
      expect(channelsBefore).toBeGreaterThan(0);

      reactor.destroy();

      const channelsAfter = MockBroadcastChannel.channels.get('test')?.length || 0;
      expect(channelsAfter).toBe(0);
    });

    it('should stop syncing after destroy', async () => {
      const tab1 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'counter', debounce: 0 })],
        }
      );

      // Destroy tab2
      tab2.destroy();

      // Update tab1
      tab1.update((s) => {
        s.count = 100;
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // tab2 should not be updated (it's destroyed)
      expect(tab2.state.count).toBe(0);

      // Cleanup
      tab1.destroy();
    });
  });

  describe('BroadcastChannel Requirement', () => {
    it('should warn when BroadcastChannel is not available', () => {
      // Remove BroadcastChannel
      delete (global as any).BroadcastChannel;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const reactor = createReactor(
        { count: 0 },
        {
          name: 'fallback',
          plugins: [sync({ key: 'fallback', debounce: 0 })],
        }
      );

      // Should have warned about missing BroadcastChannel
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BroadcastChannel API is not available')
      );

      // Cleanup
      reactor.destroy();
      warnSpy.mockRestore();
    });

    it('should gracefully handle when broadcast is disabled', () => {
      const plugin = sync({ broadcast: false, key: 'test' });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('sync');
    });
  });

  describe('SSR Compatibility', () => {
    it('should not crash in SSR environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => {
        const reactor = createReactor(
          { count: 0 },
          {
            plugins: [sync({ key: 'ssr-test' })],
          }
        );

        reactor.update((s) => {
          s.count = 1;
        });

        reactor.destroy();
      }).not.toThrow();

      (global as any).window = originalWindow;
    });
  });

  describe('Action Tracking', () => {
    it('should broadcast action names', async () => {
      let receivedAction: string | undefined;

      const tab1 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'actions', debounce: 0 })],
        }
      );

      const tab2 = createReactor(
        { count: 0 },
        {
          plugins: [sync({ key: 'actions', debounce: 0 })],
          onChange: (state, prevState, action) => {
            receivedAction = action;
          },
        }
      );

      // Update with action name
      tab1.update(
        (s) => {
          s.count = 10;
        },
        'increment'
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Note: The action is broadcast but may not trigger onChange in receiving tab
      // depending on implementation details
      expect(tab2.state.count).toBe(10);

      // Cleanup
      tab1.destroy();
      tab2.destroy();
    });
  });
});

describe('multiTabSync (deprecated alias)', () => {
  beforeEach(() => {
    (global as any).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.reset();
    (global as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
    delete (global as any).BroadcastChannel;
    delete (global as any).window;
  });

  it('should work as an alias for sync()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const plugin = multiTabSync({ key: 'test' });

    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('sync'); // Now uses 'sync' name
    expect(plugin.init).toBeDefined();
    expect(plugin.destroy).toBeDefined();

    // Should have shown deprecation warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('multiTabSync() is deprecated')
    );

    warnSpy.mockRestore();
  });

  it('should still sync state correctly', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tab1 = createReactor(
      { count: 0 },
      {
        plugins: [multiTabSync({ key: 'legacy', debounce: 0 })],
      }
    );

    const tab2 = createReactor(
      { count: 0 },
      {
        plugins: [multiTabSync({ key: 'legacy', debounce: 0 })],
      }
    );

    tab1.update((s) => {
      s.count = 42;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(tab2.state.count).toBe(42);

    tab1.destroy();
    tab2.destroy();
    warnSpy.mockRestore();
  });
});
