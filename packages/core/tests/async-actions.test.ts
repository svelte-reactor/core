/**
 * Async Actions Helper tests
 *
 * v0.2.9: Simplified API
 * - Removed retry tests (use at API layer)
 * - Removed debounce tests (use external debounce)
 * - Updated concurrency tests (only 'queue' | 'replace')
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte';
import { asyncActions } from '../src/helpers/async-actions';

interface User {
  id: number;
  name: string;
}

interface StoreState {
  users: User[];
  loading: boolean;
  error: Error | null;
}

describe('asyncActions', () => {
  let store: ReturnType<typeof createReactor<StoreState>>;

  beforeEach(() => {
    store = createReactor({
      users: [],
      loading: false,
      error: null,
    });
  });

  describe('Basic functionality', () => {
    it('should set loading state before async operation', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          expect(store.state.loading).toBe(true);
          return { users: [{ id: 1, name: 'John' }] };
        },
      });

      await api.fetchUsers();
    });

    it('should clear loading state after successful operation', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          return { users: [{ id: 1, name: 'John' }] };
        },
      });

      await api.fetchUsers();
      expect(store.state.loading).toBe(false);
    });

    it('should update state with result', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          return { users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] };
        },
      });

      await api.fetchUsers();
      expect(store.state.users).toHaveLength(2);
      expect(store.state.users[0].name).toBe('John');
    });

    it('should clear error on successful operation', async () => {
      store.state.error = new Error('Previous error');

      const api = asyncActions(store, {
        fetchUsers: async () => {
          return { users: [] };
        },
      });

      await api.fetchUsers();
      expect(store.state.error).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should set error state on failure', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          throw new Error('Network error');
        },
      });

      await expect(api.fetchUsers()).rejects.toThrow('Network error');
      expect(store.state.error).toBeInstanceOf(Error);
      expect(store.state.error?.message).toBe('Network error');
    });

    it('should clear loading state on error', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          throw new Error('Failed');
        },
      });

      await expect(api.fetchUsers()).rejects.toThrow();
      expect(store.state.loading).toBe(false);
    });

    it('should convert non-Error throws to Error', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          throw 'String error';
        },
      });

      await expect(api.fetchUsers()).rejects.toThrow();
      expect(store.state.error).toBeInstanceOf(Error);
      expect(store.state.error?.message).toBe('String error');
    });

    it('should call onError callback on failure', async () => {
      const onErrorSpy = vi.fn();

      const api = asyncActions(
        store,
        {
          fetchUsers: async () => {
            throw new Error('Test error');
          },
        },
        { onError: onErrorSpy }
      );

      await expect(api.fetchUsers()).rejects.toThrow('Test error');

      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        'fetchUsers'
      );
      expect(onErrorSpy.mock.calls[0][0].message).toBe('Test error');
    });
  });

  describe('With parameters', () => {
    it('should pass parameters to async action', async () => {
      const api = asyncActions(store, {
        createUser: async (name: string, age: number) => {
          const newUser = { id: Date.now(), name };
          return { users: [...store.state.users, newUser] };
        },
      });

      await api.createUser('Alice', 25);
      expect(store.state.users).toHaveLength(1);
      expect(store.state.users[0].name).toBe('Alice');
    });

    it('should work with multiple parameters', async () => {
      const api = asyncActions(store, {
        updateUser: async (id: number, updates: Partial<User>) => {
          const users = store.state.users.map((u) =>
            u.id === id ? { ...u, ...updates } : u
          );
          return { users };
        },
      });

      store.state.users = [{ id: 1, name: 'John' }];
      await api.updateUser(1, { name: 'Johnny' });
      expect(store.state.users[0].name).toBe('Johnny');
    });
  });

  describe('Custom options', () => {
    it('should use custom loading key', async () => {
      interface CustomState {
        data: any[];
        isLoading: boolean;
        error: Error | null;
      }

      const customStore = createReactor<CustomState>({
        data: [],
        isLoading: false,
        error: null,
      });

      const api = asyncActions(
        customStore,
        {
          fetchData: async () => {
            expect(customStore.state.isLoading).toBe(true);
            return { data: [1, 2, 3] };
          },
        },
        { loadingKey: 'isLoading' }
      );

      await api.fetchData();
      expect(customStore.state.isLoading).toBe(false);
    });

    it('should use custom error key', async () => {
      interface CustomState {
        data: any[];
        loading: boolean;
        lastError: Error | null;
      }

      const customStore = createReactor<CustomState>({
        data: [],
        loading: false,
        lastError: null,
      });

      const api = asyncActions(
        customStore,
        {
          fetchData: async () => {
            throw new Error('Custom error');
          },
        },
        { errorKey: 'lastError' }
      );

      await expect(api.fetchData()).rejects.toThrow();
      expect(customStore.state.lastError).toBeInstanceOf(Error);
      expect(customStore.state.lastError?.message).toBe('Custom error');
    });

    it('should use custom action prefix', async () => {
      const api = asyncActions(
        store,
        {
          fetchUsers: async () => ({ users: [] }),
        },
        { actionPrefix: 'api' }
      );

      await api.fetchUsers();
      // Action names should be api:fetchUsers:start, api:fetchUsers:success
    });

    it('should not reset error on start if resetErrorOnStart is false', async () => {
      const existingError = new Error('Existing error');
      store.state.error = existingError;

      const api = asyncActions(
        store,
        {
          fetchUsers: async () => {
            // Error should still be there at start
            expect(store.state.error).toBe(existingError);
            return { users: [] };
          },
        },
        { resetErrorOnStart: false }
      );

      await api.fetchUsers();
      // Error should be cleared on success
      expect(store.state.error).toBeNull();
    });
  });

  describe('Multiple actions', () => {
    it('should support multiple async actions', async () => {
      const api = asyncActions(store, {
        fetchUsers: async () => {
          return { users: [{ id: 1, name: 'John' }] };
        },
        createUser: async (name: string) => {
          const newUser = { id: Date.now(), name };
          return { users: [...store.state.users, newUser] };
        },
        deleteUser: async (id: number) => {
          const users = store.state.users.filter((u) => u.id !== id);
          return { users };
        },
      });

      await api.fetchUsers();
      expect(store.state.users).toHaveLength(1);

      await api.createUser('Jane');
      expect(store.state.users).toHaveLength(2);

      await api.deleteUser(1);
      expect(store.state.users).toHaveLength(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle API fetch scenario', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve([{ id: 1, name: 'User 1' }]),
        } as Response)
      );

      const api = asyncActions(store, {
        fetchUsers: async () => {
          const response = await fetch('/api/users');
          const users = await response.json();
          return { users };
        },
      });

      await api.fetchUsers();
      expect(store.state.users).toHaveLength(1);
      expect(store.state.loading).toBe(false);
      expect(store.state.error).toBeNull();
    });

    it('should handle API error scenario', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      const api = asyncActions(store, {
        fetchUsers: async () => {
          const response = await fetch('/api/users');
          const users = await response.json();
          return { users };
        },
      });

      await expect(api.fetchUsers()).rejects.toThrow('Network error');
      expect(store.state.loading).toBe(false);
      expect(store.state.error?.message).toBe('Network error');
    });

    it('should handle sequential operations', async () => {
      let callCount = 0;

      const api = asyncActions(store, {
        loadData: async () => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { users: [{ id: callCount, name: `User ${callCount}` }] };
        },
      });

      await api.loadData();
      await api.loadData();
      await api.loadData();

      expect(callCount).toBe(3);
      expect(store.state.users[0].name).toBe('User 3');
    });
  });

  describe('Edge cases', () => {
    it('should handle action returning null', async () => {
      const api = asyncActions(store, {
        noop: async () => null,
      });

      await api.noop();
      expect(store.state.loading).toBe(false);
    });

    it('should handle action returning undefined', async () => {
      const api = asyncActions(store, {
        noop: async () => undefined,
      });

      await api.noop();
      expect(store.state.loading).toBe(false);
    });

    it('should handle action returning primitive', async () => {
      const api = asyncActions(store, {
        getValue: async () => 42,
      });

      const result = await api.getValue();
      expect(result).toBe(42);
    });
  });

  describe('Concurrency modes', () => {
    it('should use replace mode by default (cancel previous)', async () => {
      let callCount = 0;
      const callOrder: number[] = [];

      const api = asyncActions(store, {
        fetchData: async () => {
          const thisCall = ++callCount;
          callOrder.push(thisCall);
          await new Promise((r) => setTimeout(r, 50));
          return { users: [{ id: thisCall, name: `User ${thisCall}` }] };
        },
      });

      // Start first call
      const p1 = api.fetchData().catch(() => {});
      await new Promise((r) => setTimeout(r, 10)); // Let it start

      // Start second call (should cancel first)
      const p2 = api.fetchData();

      await p2;

      expect(callOrder).toEqual([1, 2]);
      // Final state should be from second call
      expect(store.state.users[0].id).toBe(2);
    });

    it('should queue requests in queue mode', async () => {
      const callOrder: number[] = [];
      const completionOrder: number[] = [];
      let callCount = 0;

      const api = asyncActions(
        store,
        {
          fetchData: async () => {
            const thisCall = ++callCount;
            callOrder.push(thisCall);
            await new Promise((r) => setTimeout(r, 20));
            completionOrder.push(thisCall);
            return { users: [{ id: thisCall, name: `User ${thisCall}` }] };
          },
        },
        { concurrency: 'queue' }
      );

      // Start multiple calls
      const p1 = api.fetchData();
      const p2 = api.fetchData();
      const p3 = api.fetchData();

      await Promise.all([p1, p2, p3]);

      // All should complete in order
      expect(callOrder).toEqual([1, 2, 3]);
      expect(completionOrder).toEqual([1, 2, 3]);
      // Final state should be from last call
      expect(store.state.users[0].id).toBe(3);
    });

    it('should ignore stale responses in replace mode', async () => {
      let callCount = 0;
      const stateUpdates: number[] = [];

      const api = asyncActions(store, {
        fetchData: async (delay: number) => {
          const thisCall = ++callCount;
          await new Promise((r) => setTimeout(r, delay));
          return { users: [{ id: thisCall, name: `User ${thisCall}` }] };
        },
      });

      // Start slow call
      const p1 = api.fetchData(100).catch(() => {});

      // Start fast call (should replace slow one)
      await new Promise((r) => setTimeout(r, 10));
      const p2 = api.fetchData(10);

      await p2;

      // Wait for slow call to also complete
      await new Promise((r) => setTimeout(r, 150));

      // State should be from the fast (second) call
      expect(store.state.users[0].id).toBe(2);
    });
  });

  describe('Advanced complexity tests', () => {
    it('should handle concurrent async operations correctly', async () => {
      // Test that multiple concurrent operations don't interfere with each other
      interface ComplexState {
        users: User[];
        posts: Array<{ id: number; title: string }>;
        comments: Array<{ id: number; text: string }>;
        loading: boolean;
        error: Error | null;
      }

      const complexStore = createReactor<ComplexState>({
        users: [],
        posts: [],
        comments: [],
        loading: false,
        error: null,
      });

      let usersLoadingState = false;
      let postsLoadingState = false;
      let commentsLoadingState = false;

      const api = asyncActions(complexStore, {
        fetchUsers: async () => {
          usersLoadingState = complexStore.state.loading;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { users: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }] };
        },
        fetchPosts: async () => {
          postsLoadingState = complexStore.state.loading;
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { posts: [{ id: 1, title: 'Post 1' }, { id: 2, title: 'Post 2' }] };
        },
        fetchComments: async () => {
          commentsLoadingState = complexStore.state.loading;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { comments: [{ id: 1, text: 'Comment 1' }] };
        },
      });

      // Execute all operations concurrently
      const results = await Promise.all([
        api.fetchUsers(),
        api.fetchPosts(),
        api.fetchComments(),
      ]);

      // Verify all operations had loading state
      expect(usersLoadingState).toBe(true);
      expect(postsLoadingState).toBe(true);
      expect(commentsLoadingState).toBe(true);

      // Verify all data was loaded correctly
      expect(complexStore.state.users).toHaveLength(2);
      expect(complexStore.state.posts).toHaveLength(2);
      expect(complexStore.state.comments).toHaveLength(1);

      // Verify loading is cleared after all operations
      expect(complexStore.state.loading).toBe(false);
      expect(complexStore.state.error).toBeNull();
    });

    it('should handle complex nested operations with error recovery', async () => {
      // Test complex scenario: fetch users, then for each user fetch their profile,
      // with error handling and manual retry logic
      interface ProfileState {
        users: User[];
        profiles: Map<number, { bio: string; avatar: string }>;
        loading: boolean;
        error: Error | null;
        retryCount: number;
      }

      const profileStore = createReactor<ProfileState>({
        users: [],
        profiles: new Map(),
        loading: false,
        error: null,
        retryCount: 0,
      });

      let fetchUsersCallCount = 0;
      let fetchProfileCallCount = 0;
      const profileAttempts = new Map<number, number>();

      // Use queue mode to ensure profile updates don't override each other
      const api = asyncActions(profileStore, {
        fetchUsers: async () => {
          fetchUsersCallCount++;
          await new Promise((resolve) => setTimeout(resolve, 20));

          if (fetchUsersCallCount === 1) {
            // First call fails
            throw new Error('Initial fetch failed');
          }

          return {
            users: [
              { id: 1, name: 'John' },
              { id: 2, name: 'Jane' },
              { id: 3, name: 'Bob' },
            ],
          };
        },

        fetchProfile: async (userId: number) => {
          fetchProfileCallCount++;
          const attempts = (profileAttempts.get(userId) || 0) + 1;
          profileAttempts.set(userId, attempts);

          await new Promise((resolve) => setTimeout(resolve, 10));

          // Simulate occasional failures on first attempt for user 2
          if (userId === 2 && attempts === 1) {
            throw new Error(`Profile fetch failed for user ${userId}`);
          }

          const newProfiles = new Map(profileStore.state.profiles);
          newProfiles.set(userId, {
            bio: `Bio for user ${userId}`,
            avatar: `avatar_${userId}.jpg`,
          });

          return { profiles: newProfiles };
        },

        retryFetch: async () => {
          const retryCount = profileStore.state.retryCount + 1;

          try {
            await api.fetchUsers();
            return { retryCount };
          } catch (error) {
            return { retryCount };
          }
        },
      }, { concurrency: 'queue' });

      // First attempt - should fail
      try {
        await api.fetchUsers();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(profileStore.state.error?.message).toBe('Initial fetch failed');
        expect(profileStore.state.loading).toBe(false);
      }

      // Retry - should succeed
      await api.retryFetch();
      expect(profileStore.state.users).toHaveLength(3);
      expect(profileStore.state.retryCount).toBe(1);
      expect(profileStore.state.error).toBeNull();

      // Fetch profiles for all users (with manual retry for failures)
      const profilePromises = profileStore.state.users.map((user) =>
        api.fetchProfile(user.id).catch((err) => {
          // Catch and retry failed profiles
          return api.fetchProfile(user.id);
        })
      );

      await Promise.all(profilePromises);

      // Verify all profiles were loaded
      expect(profileStore.state.profiles.size).toBe(3);
      expect(profileStore.state.profiles.get(1)?.bio).toBe('Bio for user 1');
      expect(profileStore.state.profiles.get(2)?.bio).toBe('Bio for user 2');
      expect(profileStore.state.profiles.get(3)?.bio).toBe('Bio for user 3');

      // Verify final state is clean
      expect(profileStore.state.loading).toBe(false);
      expect(profileStore.state.error).toBeNull();

      // Verify call counts
      expect(fetchUsersCallCount).toBe(2); // Initial fail + retry
      expect(fetchProfileCallCount).toBe(4); // 3 users + 1 retry for user 2
    });
  });

  describe('Cancellation', () => {
    it('should allow cancelling an action', async () => {
      const api = asyncActions(store, {
        slowFetch: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { users: [{ id: 1, name: 'Slow' }] };
        },
      });

      const controller = api.slowFetch();

      // Cancel immediately
      controller.cancel();

      await expect(controller).rejects.toThrow('Action cancelled');
      expect(store.state.users).toHaveLength(0);
    });

    it('should provide AbortController for fetch API', () => {
      const api = asyncActions(store, {
        fetchData: async () => ({ users: [] }),
      });

      const controller = api.fetchData();

      expect(controller.abort).toBeDefined();
      expect(controller.cancel).toBeDefined();

      // Catch rejection before cancelling
      controller.catch(() => {});
      controller.cancel();
    });

    it('should have cancel method on returned controller', () => {
      const api = asyncActions(store, {
        cancellableFetch: async () => {
          return { users: [{ id: 1, name: 'Test' }] };
        },
      });

      const controller = api.cancellableFetch();

      // Controller should have cancel method
      expect(typeof controller.cancel).toBe('function');

      // Cleanup - catch any rejection to avoid unhandled promise rejection
      controller.catch(() => {});
      controller.cancel();
    });
  });

  describe('Manual retry at API layer (v0.2.9 pattern)', () => {
    it('should work with manual retry wrapper', async () => {
      let attemptCount = 0;

      // Retry logic at API layer (recommended pattern in v0.2.9)
      const fetchWithRetry = async () => {
        for (let i = 0; i < 3; i++) {
          try {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error(`Attempt ${attemptCount} failed`);
            }
            return { users: [{ id: 1, name: 'Success' }] };
          } catch (e) {
            if (i === 2) throw e;
            await new Promise((r) => setTimeout(r, 10));
          }
        }
        throw new Error('Max retries exceeded');
      };

      const api = asyncActions(store, {
        fetchUsers: fetchWithRetry,
      });

      await api.fetchUsers();

      expect(attemptCount).toBe(3);
      expect(store.state.users).toHaveLength(1);
      expect(store.state.error).toBeNull();
    });
  });
});
