/**
 * Advanced Concurrency & Stress Tests
 * Testing race conditions, parallel updates, and multi-threading scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createReactor } from '../src/core/reactor.svelte.js';
import { simpleStore, derived, get } from '../src/index.js';
import { undoRedo, persist } from '../src/plugins/index.js';

describe('Advanced Concurrency & Stress Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Test 1: Concurrent Updates Race Condition', () => {
    it('should handle hundreds of concurrent updates correctly', async () => {
      interface CounterState {
        count: number;
        updates: number;
      }

      const reactor = createReactor<CounterState>({
        count: 0,
        updates: 0
      });

      // Track all updates
      const updateLog: number[] = [];
      reactor.subscribe(state => {
        updateLog.push(state.count);
      });

      // Simulate 500 concurrent updates from different sources
      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(
          new Promise<void>(resolve => {
            // Random delay to simulate real-world async operations
            setTimeout(() => {
              reactor.update(state => {
                state.count += 1;
                state.updates += 1;
              });
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      // After all updates, count should be exactly 500
      expect(reactor.state.count).toBe(500);
      expect(reactor.state.updates).toBe(500);

      // All updates should be logged (including initial state)
      expect(updateLog.length).toBeGreaterThan(500);

      reactor.destroy();
    });

    it('should maintain data integrity with parallel derived stores', async () => {
      const baseStore = simpleStore(0);

      // Create multiple derived stores
      const doubled = derived(baseStore, $val => $val * 2);
      const tripled = derived(baseStore, $val => $val * 3);
      const quadrupled = derived(baseStore, $val => $val * 4);

      // Track values
      const doubledValues: number[] = [];
      const tripledValues: number[] = [];
      const quadrupledValues: number[] = [];

      doubled.subscribe(v => doubledValues.push(v));
      tripled.subscribe(v => tripledValues.push(v));
      quadrupled.subscribe(v => quadrupledValues.push(v));

      // Rapid fire updates
      const updates = 100;
      const promises = [];

      for (let i = 1; i <= updates; i++) {
        promises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              baseStore.set(i);
              resolve();
            }, Math.random() * 50);
          })
        );
      }

      await Promise.all(promises);

      // Wait for all derived stores to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Final values should be correct
      const finalBase = get(baseStore);
      expect(get(doubled)).toBe(finalBase * 2);
      expect(get(tripled)).toBe(finalBase * 3);
      expect(get(quadrupled)).toBe(finalBase * 4);

      // All derived stores should have been updated multiple times
      expect(doubledValues.length).toBeGreaterThan(1);
      expect(tripledValues.length).toBeGreaterThan(1);
      expect(quadrupledValues.length).toBeGreaterThan(1);
    });
  });

  describe('Test 2: Multi-Subscriber Race Conditions', () => {
    it('should handle 100 subscribers receiving concurrent updates', async () => {
      interface SharedState {
        value: number;
        lastUpdate: number;
      }

      const shared = createReactor<SharedState>({
        value: 0,
        lastUpdate: Date.now()
      });

      // Create 100 subscribers
      const subscribers: Array<{ values: number[]; unsubscribe: () => void }> = [];

      for (let i = 0; i < 100; i++) {
        const values: number[] = [];
        const unsubscribe = shared.subscribe(state => {
          values.push(state.value);
        });
        subscribers.push({ values, unsubscribe });
      }

      // Perform 200 rapid updates
      const updatePromises = [];
      for (let i = 1; i <= 200; i++) {
        updatePromises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              shared.update(state => {
                state.value = i;
                state.lastUpdate = Date.now();
              });
              resolve();
            }, Math.random() * 20);
          })
        );
      }

      await Promise.all(updatePromises);

      // Wait for all subscribers to receive updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // All subscribers should have received updates
      subscribers.forEach(sub => {
        expect(sub.values.length).toBeGreaterThan(0);
        // Last value should match current state
        expect(sub.values[sub.values.length - 1]).toBe(shared.state.value);
      });

      // Cleanup
      subscribers.forEach(sub => sub.unsubscribe());
      shared.destroy();
    });

    it('should handle subscribers being added/removed during updates', async () => {
      const reactor = createReactor({ count: 0 });

      const allValues: number[] = [];
      let activeSubscribers = 0;

      // Start updates
      const updateInterval = setInterval(() => {
        reactor.update(state => {
          state.count += 1;
        });
      }, 5);

      // Dynamically add and remove subscribers
      const subscriptionPromises = [];

      for (let i = 0; i < 50; i++) {
        subscriptionPromises.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              activeSubscribers++;
              const values: number[] = [];

              const unsub = reactor.subscribe(state => {
                values.push(state.count);
              });

              // Subscribe for random duration
              setTimeout(() => {
                allValues.push(...values);
                unsub();
                activeSubscribers--;
                resolve();
              }, Math.random() * 100);
            }, Math.random() * 100);
          })
        );
      }

      await Promise.all(subscriptionPromises);
      clearInterval(updateInterval);

      // Should have collected many values
      expect(allValues.length).toBeGreaterThan(0);

      // No subscribers should remain
      expect(activeSubscribers).toBe(0);

      reactor.destroy();
    });
  });

  describe('Test 3: Complex Multi-Store Synchronization', () => {
    it('should synchronize state across multiple reactors with derived connections', async () => {
      // Simulate a complex app with multiple interconnected stores
      interface UserState {
        id: number;
        name: string;
        points: number;
      }

      interface GameState {
        level: number;
        score: number;
        multiplier: number;
      }

      interface LeaderboardEntry {
        userId: number;
        totalScore: number;
      }

      // Create stores
      const user = createReactor<UserState>({
        id: 1,
        name: 'Player1',
        points: 0
      });

      const game = createReactor<GameState>({
        level: 1,
        score: 0,
        multiplier: 1
      });

      const leaderboard = createReactor<{ entries: LeaderboardEntry[] }>({
        entries: []
      });

      // Derived: total score = game score * user points * multiplier
      const totalScore = derived(
        [user, game],
        ([$user, $game]) => $user.points * $game.score * $game.multiplier
      );

      // Subscribe to update leaderboard
      totalScore.subscribe(score => {
        leaderboard.update(state => {
          const existing = state.entries.findIndex(e => e.userId === get(user).id);
          if (existing >= 0) {
            state.entries[existing].totalScore = score;
          } else {
            state.entries.push({ userId: get(user).id, totalScore: score });
          }
        });
      });

      // Simulate 100 game events happening concurrently
      const gameEvents = [];

      for (let i = 0; i < 100; i++) {
        gameEvents.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              const eventType = Math.random();

              if (eventType < 0.33) {
                // Gain points
                user.update(state => {
                  state.points += Math.floor(Math.random() * 10) + 1;
                });
              } else if (eventType < 0.66) {
                // Score points
                game.update(state => {
                  state.score += Math.floor(Math.random() * 100) + 1;
                });
              } else {
                // Level up (increases multiplier)
                game.update(state => {
                  state.level += 1;
                  state.multiplier = state.level * 0.1 + 1;
                });
              }

              resolve();
            }, Math.random() * 50);
          })
        );
      }

      await Promise.all(gameEvents);

      // Wait for all derived updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify synchronization
      const currentTotalScore = get(totalScore);
      const expectedScore = user.state.points * game.state.score * game.state.multiplier;

      expect(currentTotalScore).toBe(expectedScore);

      // Leaderboard should have been updated
      expect(leaderboard.state.entries.length).toBe(1);
      expect(leaderboard.state.entries[0].totalScore).toBe(currentTotalScore);
      expect(leaderboard.state.entries[0].userId).toBe(1);

      // Cleanup
      user.destroy();
      game.destroy();
      leaderboard.destroy();
    });

    it('should handle complex state with undo/redo during concurrent updates', async () => {
      interface ComplexState {
        users: Array<{ id: number; name: string; score: number }>;
        metadata: { lastUpdate: number; version: number };
      }

      const reactor = createReactor<ComplexState>(
        {
          users: [],
          metadata: { lastUpdate: Date.now(), version: 1 }
        },
        {
          plugins: [undoRedo({ limit: 50 })]
        }
      );

      // Perform 50 concurrent operations
      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              const opType = Math.random();

              if (opType < 0.4) {
                // Add user
                reactor.update(state => {
                  state.users.push({
                    id: state.users.length + 1,
                    name: `User${state.users.length + 1}`,
                    score: 0
                  });
                  state.metadata.version += 1;
                  state.metadata.lastUpdate = Date.now();
                });
              } else if (opType < 0.7 && reactor.state.users.length > 0) {
                // Update random user score
                reactor.update(state => {
                  const randomIndex = Math.floor(Math.random() * state.users.length);
                  state.users[randomIndex].score += Math.floor(Math.random() * 10);
                  state.metadata.version += 1;
                  state.metadata.lastUpdate = Date.now();
                });
              } else if (reactor.canUndo()) {
                // Random undo
                reactor.undo();
              }

              resolve();
            }, Math.random() * 30);
          })
        );
      }

      await Promise.all(operations);

      // Wait for all updates to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // State should be valid
      expect(reactor.state.metadata.version).toBeGreaterThan(0);
      expect(reactor.state.users.every(u => u.id > 0)).toBe(true);

      // Should have undo history
      expect(reactor.canUndo()).toBe(true);

      // Test undo/redo consistency
      const beforeUndo = { ...reactor.state };
      reactor.undo();
      expect(reactor.state).not.toEqual(beforeUndo);

      reactor.redo();
      expect(reactor.state).toEqual(beforeUndo);

      reactor.destroy();
    });

    it('should handle persistence + concurrent updates without data loss', async () => {
      interface PersistentState {
        transactions: Array<{ id: number; amount: number; timestamp: number }>;
        balance: number;
      }

      const key = 'concurrency-persist-test';

      const reactor = createReactor<PersistentState>(
        {
          transactions: [],
          balance: 1000
        },
        {
          plugins: [persist({ key, debounce: 10 })]
        }
      );

      // Perform 200 concurrent transactions
      const transactions = [];

      for (let i = 0; i < 200; i++) {
        transactions.push(
          new Promise<void>(resolve => {
            setTimeout(() => {
              reactor.update(state => {
                const amount = Math.floor(Math.random() * 100) - 50; // -50 to +50
                state.transactions.push({
                  id: state.transactions.length + 1,
                  amount,
                  timestamp: Date.now()
                });
                state.balance += amount;
              });
              resolve();
            }, Math.random() * 20);
          })
        );
      }

      await Promise.all(transactions);

      // Wait for debounced persist
      await new Promise(resolve => setTimeout(resolve, 100));

      // Calculate expected balance
      const expectedBalance = 1000 + reactor.state.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(reactor.state.balance).toBe(expectedBalance);

      // Verify persistence
      const stored = localStorage.getItem(key);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.balance).toBe(reactor.state.balance);
      expect(parsed.transactions.length).toBe(200);

      // Create new reactor - should load persisted state
      const reactor2 = createReactor<PersistentState>(
        {
          transactions: [],
          balance: 0
        },
        {
          plugins: [persist({ key })]
        }
      );

      expect(reactor2.state.balance).toBe(expectedBalance);
      expect(reactor2.state.transactions.length).toBe(200);

      reactor.destroy();
      reactor2.destroy();
    });
  });

  describe('Performance & Memory Tests', () => {
    it('should handle rapid subscribe/unsubscribe cycles without memory leaks', () => {
      const reactor = createReactor({ count: 0 });

      // Simulate 1000 subscribe/unsubscribe cycles
      for (let i = 0; i < 1000; i++) {
        const unsub = reactor.subscribe(() => {
          // Empty subscriber
        });
        unsub(); // Immediately unsubscribe
      }

      // Should still work normally
      reactor.update(state => {
        state.count = 42;
      });

      expect(reactor.state.count).toBe(42);

      reactor.destroy();
    });

    it('should efficiently handle 10,000 state updates', () => {
      const reactor = createReactor({ count: 0 });

      const start = performance.now();

      // 10,000 updates
      for (let i = 1; i <= 10000; i++) {
        reactor.update(state => {
          state.count = i;
        });
      }

      const duration = performance.now() - start;

      expect(reactor.state.count).toBe(10000);

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);

      reactor.destroy();
    });
  });
});
