# Plugin Development Guide

Complete guide to creating custom plugins for svelte-reactor.

---

## Table of Contents

- [Introduction](#introduction)
- [Plugin API Reference](#plugin-api-reference)
- [Tutorial: Creating Your First Plugin](#tutorial-creating-your-first-plugin)
- [Advanced Patterns](#advanced-patterns)
- [Real-world Examples](#real-world-examples)
- [Testing Plugins](#testing-plugins)
- [Best Practices](#best-practices)

---

## Introduction

### What are Plugins?

Plugins are the primary way to extend svelte-reactor's functionality. They allow you to:

- **Intercept state changes** before and after they happen
- **Add side effects** like logging, persistence, or analytics
- **Validate state** before updates are applied
- **Transform state** during updates
- **Integrate with external services** (APIs, databases, etc.)

### Plugin Lifecycle

Every plugin goes through these phases:

1. **Creation** - Plugin factory function is called with options
2. **Initialization** - `init()` is called with plugin context
3. **Runtime** - Middleware hooks are triggered on state changes
4. **Cleanup** - `destroy()` is called when reactor is destroyed

### When to Create a Custom Plugin

Create a plugin when you need to:

- ✅ Add cross-cutting concerns (logging, analytics, monitoring)
- ✅ Integrate with external systems (databases, APIs, WebSockets)
- ✅ Implement validation or business rules
- ✅ Add state transformations or normalization
- ✅ Create reusable state management patterns

Don't create a plugin when:

- ❌ You only need it in one place (use middleware directly)
- ❌ It's simple business logic (put it in update functions)
- ❌ You're just wrapping one function (use a helper instead)

---

## Plugin API Reference

### ReactorPlugin Interface

```typescript
interface ReactorPlugin<T extends object> {
  /** Plugin name (must be unique) */
  name: string;

  /** Initialize plugin with context */
  init(context: PluginContext<T>): void;

  /** Optional cleanup when reactor is destroyed */
  destroy?(): void;
}
```

### PluginContext Interface

The context object provided to your plugin's `init()` method:

```typescript
interface PluginContext<T extends object> {
  /** Reactive state (Svelte $state) */
  state: T;

  /** Undo/Redo history (if undoRedo plugin is enabled) */
  history?: UndoRedoHistory<T>;

  /** Registered middlewares array */
  middlewares: Middleware<T>[];

  /** Reactor name */
  name?: string;
}
```

### Middleware Interface

Middleware hooks that your plugin can register:

```typescript
interface Middleware<T extends object> {
  /** Middleware name */
  name: string;

  /** Called BEFORE state update is applied */
  onBeforeUpdate?(prevState: T, nextState: T, action?: string): void;

  /** Called AFTER state update is applied */
  onAfterUpdate?(prevState: T, nextState: T, action?: string): void;

  /** Called when an error occurs during update */
  onError?(error: Error): void;
}
```

### Plugin Factory Pattern

The recommended way to create plugins:

```typescript
export function myPlugin<T extends object>(
  options?: MyPluginOptions
): ReactorPlugin<T> {
  return {
    name: 'myPlugin',

    init(context: PluginContext<T>): void {
      // Register middleware
      const middleware: Middleware<T> = {
        name: 'myPlugin-middleware',

        onBeforeUpdate(prevState, nextState, action) {
          // Logic before update
        },

        onAfterUpdate(prevState, nextState, action) {
          // Logic after update
        },

        onError(error) {
          // Error handling
        }
      };

      context.middlewares.push(middleware);
    },

    destroy(): void {
      // Cleanup resources
    }
  };
}
```

---

## Tutorial: Creating Your First Plugin

### Example 1: Validation Plugin

A plugin that validates state before updates are applied.

**Use case:** Ensure data integrity by validating state against a schema.

```typescript
// src/plugins/validation-plugin.ts

import type { ReactorPlugin, PluginContext, Middleware } from 'svelte-reactor';

interface ValidationOptions<T> {
  /** Validation function */
  validate: (state: T) => boolean | string;

  /** Throw error on validation failure (default: true) */
  throwOnError?: boolean;

  /** Custom error message */
  errorMessage?: string;
}

export function validation<T extends object>(
  options: ValidationOptions<T>
): ReactorPlugin<T> {
  const { validate, throwOnError = true, errorMessage } = options;

  return {
    name: 'validation',

    init(context: PluginContext<T>): void {
      const middleware: Middleware<T> = {
        name: 'validation-middleware',

        onBeforeUpdate(prevState: T, nextState: T, action?: string): void {
          const result = validate(nextState);

          if (result !== true) {
            const message = typeof result === 'string'
              ? result
              : errorMessage || 'Validation failed';

            if (throwOnError) {
              throw new Error(`[validation] ${message} (action: ${action})`);
            } else {
              console.warn(`[validation] ${message}`, nextState);
            }
          }
        }
      };

      context.middlewares.push(middleware);
    }
  };
}
```

**Usage:**

```typescript
import { createReactor } from 'svelte-reactor';
import { validation } from './plugins/validation-plugin';

const userStore = createReactor(
  { name: '', age: 0, email: '' },
  {
    plugins: [
      validation({
        validate: (state) => {
          if (!state.name) return 'Name is required';
          if (state.age < 0) return 'Age must be positive';
          if (!state.email.includes('@')) return 'Invalid email';
          return true;
        }
      })
    ]
  }
);

// This will throw an error
userStore.update(s => {
  s.email = 'invalid'; // ❌ Error: Invalid email
});

// This will succeed
userStore.update(s => {
  s.name = 'Alice';
  s.age = 25;
  s.email = 'alice@example.com'; // ✅
});
```

---

### Example 2: Analytics Plugin

Track state changes for analytics and monitoring.

**Use case:** Send analytics events when specific state changes occur.

```typescript
// src/plugins/analytics-plugin.ts

import type { ReactorPlugin, PluginContext, Middleware } from 'svelte-reactor';

interface AnalyticsOptions {
  /** Analytics tracking function */
  track?: (event: string, properties: any) => void;

  /** Debounce tracking events (ms) */
  debounce?: number;

  /** Filter which actions to track */
  filter?: (action?: string) => boolean;
}

export function analytics<T extends object>(
  options: AnalyticsOptions = {}
): ReactorPlugin<T> {
  const {
    track = (event, props) => console.log('[Analytics]', event, props),
    debounce = 0,
    filter = () => true
  } = options;

  let debounceTimer: any;

  return {
    name: 'analytics',

    init(context: PluginContext<T>): void {
      const middleware: Middleware<T> = {
        name: 'analytics-middleware',

        onAfterUpdate(prevState: T, nextState: T, action?: string): void {
          // Skip if action is filtered out
          if (!filter(action)) return;

          // Clear existing timer
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          // Debounce tracking
          debounceTimer = setTimeout(() => {
            const changes = findChanges(prevState, nextState);

            track('state_changed', {
              reactor: context.name,
              action,
              changes,
              timestamp: Date.now()
            });
          }, debounce);
        }
      };

      context.middlewares.push(middleware);
    },

    destroy(): void {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    }
  };
}

// Helper function to find changes
function findChanges(prev: any, next: any): Record<string, any> {
  const changes: Record<string, any> = {};

  for (const key in next) {
    if (prev[key] !== next[key]) {
      changes[key] = { from: prev[key], to: next[key] };
    }
  }

  return changes;
}
```

**Usage:**

```typescript
import { createReactor } from 'svelte-reactor';
import { analytics } from './plugins/analytics-plugin';

const store = createReactor(
  { count: 0, user: null },
  {
    name: 'app-store',
    plugins: [
      analytics({
        track: (event, properties) => {
          // Send to analytics service
          window.gtag?.('event', event, properties);
        },
        debounce: 1000, // Track at most once per second
        filter: (action) => !action?.startsWith('temp:') // Ignore temp actions
      })
    ]
  }
);

store.update(s => { s.count++; }, 'increment');
// Tracks: { event: 'state_changed', action: 'increment', changes: { count: { from: 0, to: 1 } } }
```

---

### Example 3: Snapshot Plugin

Automatically save state snapshots at intervals.

**Use case:** Create automatic backups for undo/redo or crash recovery.

```typescript
// src/plugins/snapshot-plugin.ts

import type { ReactorPlugin, PluginContext, Middleware } from 'svelte-reactor';
import { deepClone } from 'svelte-reactor';

interface SnapshotOptions {
  /** Snapshot interval in ms (default: 5000) */
  interval?: number;

  /** Maximum snapshots to keep (default: 10) */
  maxSnapshots?: number;

  /** Callback when snapshot is created */
  onSnapshot?: (snapshot: any, index: number) => void;
}

interface Snapshot<T> {
  state: T;
  timestamp: number;
  index: number;
}

export function snapshot<T extends object>(
  options: SnapshotOptions = {}
): ReactorPlugin<T> {
  const {
    interval = 5000,
    maxSnapshots = 10,
    onSnapshot
  } = options;

  let snapshots: Snapshot<T>[] = [];
  let snapshotTimer: any;
  let updateCount = 0;
  let context: PluginContext<T> | null = null;

  function createSnapshot(): void {
    if (!context) return;

    const snapshot: Snapshot<T> = {
      state: deepClone(context.state),
      timestamp: Date.now(),
      index: updateCount
    };

    snapshots.push(snapshot);

    // Keep only last N snapshots
    if (snapshots.length > maxSnapshots) {
      snapshots.shift();
    }

    onSnapshot?.(snapshot.state, snapshot.index);
  }

  return {
    name: 'snapshot',

    init(ctx: PluginContext<T>): void {
      context = ctx;

      // Create initial snapshot
      createSnapshot();

      // Start periodic snapshots
      snapshotTimer = setInterval(createSnapshot, interval);

      const middleware: Middleware<T> = {
        name: 'snapshot-middleware',

        onAfterUpdate(): void {
          updateCount++;
        }
      };

      ctx.middlewares.push(middleware);
    },

    destroy(): void {
      if (snapshotTimer) {
        clearInterval(snapshotTimer);
      }
      snapshots = [];
      context = null;
    }
  };
}

// Utility: Get all snapshots
export function getSnapshots<T>(): Snapshot<T>[] {
  // This would need to be implemented with a global registry
  // or returned from the plugin somehow
  return [];
}
```

**Usage:**

```typescript
import { createReactor } from 'svelte-reactor';
import { snapshot } from './plugins/snapshot-plugin';

const editor = createReactor(
  { content: '', cursor: 0 },
  {
    plugins: [
      snapshot({
        interval: 30000, // Snapshot every 30 seconds
        maxSnapshots: 20, // Keep last 20 snapshots
        onSnapshot: (state, index) => {
          console.log(`Snapshot #${index} created`, state);
          // Could save to IndexedDB for crash recovery
          localStorage.setItem('editor-backup', JSON.stringify(state));
        }
      })
    ]
  }
);
```

---

### Example 4: Encryption Plugin

Encrypt sensitive data before persistence.

**Use case:** Automatically encrypt/decrypt sensitive fields when persisting.

```typescript
// src/plugins/encryption-plugin.ts

import type { ReactorPlugin, PluginContext, Middleware } from 'svelte-reactor';

interface EncryptionOptions {
  /** Fields to encrypt */
  fields: string[];

  /** Encryption function */
  encrypt: (value: any) => string;

  /** Decryption function */
  decrypt: (encrypted: string) => any;
}

export function encryption<T extends object>(
  options: EncryptionOptions
): ReactorPlugin<T> {
  const { fields, encrypt, decrypt } = options;

  return {
    name: 'encryption',

    init(context: PluginContext<T>): void {
      // Decrypt on init if data exists
      for (const field of fields) {
        const value = (context.state as any)[field];
        if (typeof value === 'string' && value.startsWith('encrypted:')) {
          try {
            (context.state as any)[field] = decrypt(value.slice(10));
          } catch (error) {
            console.error(`[encryption] Failed to decrypt ${field}:`, error);
          }
        }
      }

      const middleware: Middleware<T> = {
        name: 'encryption-middleware',

        onAfterUpdate(prevState: T, nextState: T): void {
          // Encrypt sensitive fields
          for (const field of fields) {
            const value = (nextState as any)[field];
            if (value !== undefined && value !== null) {
              // Only encrypt if changed and not already encrypted
              const prevValue = (prevState as any)[field];
              if (value !== prevValue) {
                const encrypted = encrypt(value);
                // Store with prefix to identify encrypted data
                (nextState as any)[field] = `encrypted:${encrypted}`;
              }
            }
          }
        }
      };

      context.middlewares.push(middleware);
    }
  };
}
```

**Usage:**

```typescript
import { createReactor } from 'svelte-reactor';
import { persist } from 'svelte-reactor/plugins';
import { encryption } from './plugins/encryption-plugin';

// Simple encryption (use a real library in production!)
function simpleEncrypt(value: any): string {
  return btoa(JSON.stringify(value));
}

function simpleDecrypt(encrypted: string): any {
  return JSON.parse(atob(encrypted));
}

const authStore = createReactor(
  { username: '', password: '', token: '' },
  {
    plugins: [
      encryption({
        fields: ['password', 'token'],
        encrypt: simpleEncrypt,
        decrypt: simpleDecrypt
      }),
      persist({
        key: 'auth',
        // password and token will be encrypted before storage
      })
    ]
  }
);

authStore.update(s => {
  s.password = 'secret123';
  // Stored as: "encrypted:eyJwYXNzd29yZCI6InNlY3JldDEyMyJ9"
});
```

---

## Advanced Patterns

### Pattern 1: Composing Multiple Plugins

Plugins can work together by sharing data through the context:

```typescript
// Plugin A sets data
export function pluginA<T>(): ReactorPlugin<T> {
  return {
    name: 'pluginA',
    init(context) {
      // Add custom property to context
      (context as any).sharedData = { someValue: 42 };

      context.middlewares.push({
        name: 'pluginA-middleware',
        onAfterUpdate() {
          (context as any).sharedData.someValue++;
        }
      });
    }
  };
}

// Plugin B reads data
export function pluginB<T>(): ReactorPlugin<T> {
  return {
    name: 'pluginB',
    init(context) {
      context.middlewares.push({
        name: 'pluginB-middleware',
        onAfterUpdate() {
          const sharedData = (context as any).sharedData;
          if (sharedData) {
            console.log('Shared value:', sharedData.someValue);
          }
        }
      });
    }
  };
}

// Usage
const store = createReactor(state, {
  plugins: [pluginA(), pluginB()] // Order matters!
});
```

### Pattern 2: Plugin Communication via Events

```typescript
// Event bus for plugins
class PluginEventBus {
  private listeners = new Map<string, Function[]>();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }
}

const eventBus = new PluginEventBus();

// Plugin A emits events
export function eventEmitterPlugin<T>(): ReactorPlugin<T> {
  return {
    name: 'eventEmitter',
    init(context) {
      context.middlewares.push({
        name: 'eventEmitter-middleware',
        onAfterUpdate(prev, next, action) {
          eventBus.emit('state:changed', { prev, next, action });
        }
      });
    }
  };
}

// Plugin B listens to events
export function eventListenerPlugin<T>(): ReactorPlugin<T> {
  return {
    name: 'eventListener',
    init() {
      eventBus.on('state:changed', (data) => {
        console.log('Received event:', data);
      });
    }
  };
}
```

### Pattern 3: Conditional Plugin Activation

```typescript
export function conditionalPlugin<T extends object>(
  condition: () => boolean,
  plugin: ReactorPlugin<T>
): ReactorPlugin<T> {
  return {
    name: `conditional:${plugin.name}`,

    init(context) {
      if (condition()) {
        plugin.init(context);
      } else {
        console.log(`[${plugin.name}] Skipped (condition not met)`);
      }
    },

    destroy() {
      if (condition() && plugin.destroy) {
        plugin.destroy();
      }
    }
  };
}

// Usage
const store = createReactor(state, {
  plugins: [
    conditionalPlugin(
      () => process.env.NODE_ENV === 'development',
      logger({ collapsed: false })
    )
  ]
});
```

### Pattern 4: Performance Monitoring

```typescript
export function performanceMonitor<T extends object>(
  options: { slowThreshold?: number } = {}
): ReactorPlugin<T> {
  const { slowThreshold = 16 } = options; // 16ms = 60fps

  return {
    name: 'performanceMonitor',

    init(context) {
      const timings = new Map<string, number>();

      context.middlewares.push({
        name: 'performance-before',
        onBeforeUpdate(prev, next, action) {
          timings.set(action || 'unknown', performance.now());
        }
      });

      context.middlewares.push({
        name: 'performance-after',
        onAfterUpdate(prev, next, action) {
          const start = timings.get(action || 'unknown');
          if (start) {
            const duration = performance.now() - start;

            if (duration > slowThreshold) {
              console.warn(
                `[Performance] Slow update: ${action} took ${duration.toFixed(2)}ms`
              );
            }

            timings.delete(action || 'unknown');
          }
        }
      });
    }
  };
}
```

---

## Real-world Examples

### Form Validation with Auto-save

```typescript
import { createReactor } from 'svelte-reactor';
import { persist, multiTabSync } from 'svelte-reactor/plugins';
import { validation } from './plugins/validation-plugin';
import { analytics } from './plugins/analytics-plugin';

interface FormState {
  name: string;
  email: string;
  age: number;
  submitted: boolean;
}

const formStore = createReactor<FormState>(
  { name: '', email: '', age: 0, submitted: false },
  {
    name: 'contact-form',
    plugins: [
      // Validate before saving
      validation({
        validate: (state) => {
          if (state.submitted) {
            if (!state.name) return 'Name is required';
            if (!state.email.includes('@')) return 'Invalid email';
            if (state.age < 18) return 'Must be 18 or older';
          }
          return true;
        },
        throwOnError: false // Just warn, don't block
      }),

      // Auto-save draft
      persist({
        key: 'contact-form-draft',
        debounce: 1000,
        omit: ['submitted'] // Don't persist submission state
      }),

      // Sync across tabs
      multiTabSync({
        key: 'contact-form',
        debounce: 500
      }),

      // Track form interactions
      analytics({
        track: (event, props) => {
          console.log('Form event:', event, props);
        },
        filter: (action) => action?.startsWith('form:')
      })
    ]
  }
);

// Usage in component
formStore.update(s => { s.name = 'Alice'; }, 'form:name-changed');
formStore.update(s => { s.submitted = true; }, 'form:submit');
```

### API Sync Plugin

```typescript
interface ApiSyncOptions<T> {
  endpoint: string;
  syncInterval?: number;
  onConflict?: (local: T, remote: T) => T;
}

export function apiSync<T extends object>(
  options: ApiSyncOptions<T>
): ReactorPlugin<T> {
  const { endpoint, syncInterval = 30000, onConflict } = options;
  let syncTimer: any;

  return {
    name: 'apiSync',

    init(context) {
      // Load initial data
      fetch(endpoint)
        .then(res => res.json())
        .then(data => {
          Object.assign(context.state, data);
        });

      // Periodic sync
      syncTimer = setInterval(async () => {
        try {
          const response = await fetch(endpoint);
          const remoteData = await response.json();

          if (onConflict) {
            const resolved = onConflict(context.state, remoteData);
            Object.assign(context.state, resolved);
          } else {
            // Simple merge (remote wins)
            Object.assign(context.state, remoteData);
          }
        } catch (error) {
          console.error('[apiSync] Sync failed:', error);
        }
      }, syncInterval);

      // Push changes to API
      context.middlewares.push({
        name: 'apiSync-middleware',
        onAfterUpdate(prev, next) {
          fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next)
          }).catch(err => console.error('[apiSync] Push failed:', err));
        }
      });
    },

    destroy() {
      if (syncTimer) clearInterval(syncTimer);
    }
  };
}
```

---

## Testing Plugins

### Unit Testing a Plugin

```typescript
import { describe, it, expect } from 'vitest';
import { createReactor } from 'svelte-reactor';
import { validation } from './validation-plugin';

describe('Validation Plugin', () => {
  it('should validate state before update', () => {
    const store = createReactor(
      { value: 0 },
      {
        plugins: [
          validation({
            validate: (state) => state.value >= 0 || 'Value must be positive'
          })
        ]
      }
    );

    // Valid update
    expect(() => {
      store.update(s => { s.value = 10; });
    }).not.toThrow();

    expect(store.state.value).toBe(10);

    // Invalid update
    expect(() => {
      store.update(s => { s.value = -5; });
    }).toThrow('Value must be positive');

    // State should not change
    expect(store.state.value).toBe(10);
  });

  it('should allow custom error messages', () => {
    const store = createReactor(
      { value: 0 },
      {
        plugins: [
          validation({
            validate: (state) => state.value >= 0,
            errorMessage: 'Custom error message'
          })
        ]
      }
    );

    expect(() => {
      store.update(s => { s.value = -1; });
    }).toThrow('Custom error message');
  });
});
```

### Integration Testing

```typescript
describe('Plugin Integration', () => {
  it('should work with persist and validation', async () => {
    const store = createReactor(
      { count: 0 },
      {
        plugins: [
          validation({
            validate: (s) => s.count >= 0
          }),
          persist({
            key: 'test-store',
            storage: 'memory'
          })
        ]
      }
    );

    store.update(s => { s.count = 5; });
    expect(store.state.count).toBe(5);

    // Create new instance - should load from storage
    const store2 = createReactor(
      { count: 0 },
      {
        plugins: [
          validation({
            validate: (s) => s.count >= 0
          }),
          persist({
            key: 'test-store',
            storage: 'memory'
          })
        ]
      }
    );

    expect(store2.state.count).toBe(5);
  });
});
```

---

## Best Practices

### 1. Naming Conventions

```typescript
// ✅ Good: Descriptive, verb-based names
export function validation<T>(options) { ... }
export function analytics<T>(options) { ... }
export function apiSync<T>(options) { ... }

// ❌ Bad: Generic or unclear names
export function plugin1<T>(options) { ... }
export function myPlugin<T>(options) { ... }
```

### 2. Error Handling

```typescript
export function robustPlugin<T>(): ReactorPlugin<T> {
  return {
    name: 'robust',

    init(context) {
      context.middlewares.push({
        name: 'robust-middleware',

        onAfterUpdate(prev, next) {
          try {
            // Your logic here
          } catch (error) {
            console.error('[robust] Error:', error);
            // Don't throw - let other plugins continue
          }
        },

        onError(error) {
          // Handle errors from other plugins
          console.error('[robust] External error:', error);
        }
      });
    }
  };
}
```

### 3. Performance Considerations

```typescript
// ✅ Good: Debounce expensive operations
export function expensivePlugin<T>(options: { debounce?: number } = {}): ReactorPlugin<T> {
  const { debounce = 500 } = options;
  let timer: any;

  return {
    name: 'expensive',
    init(context) {
      context.middlewares.push({
        name: 'expensive-middleware',
        onAfterUpdate() {
          clearTimeout(timer);
          timer = setTimeout(() => {
            // Expensive operation
          }, debounce);
        }
      });
    },
    destroy() {
      clearTimeout(timer);
    }
  };
}
```

### 4. TypeScript Best Practices

```typescript
// ✅ Good: Strict typing with generics
export function typedPlugin<T extends { id: string }>(
  options: TypedPluginOptions<T>
): ReactorPlugin<T> {
  return {
    name: 'typed',
    init(context: PluginContext<T>) {
      // TypeScript knows T has 'id' property
      console.log(context.state.id);
    }
  };
}

// ✅ Good: Export options interface
export interface TypedPluginOptions<T> {
  validate?: (state: T) => boolean;
  transform?: (state: T) => T;
}
```

### 5. Documentation

Always include:
- Purpose and use cases
- Options interface with JSDoc
- Usage examples
- Browser compatibility notes
- Performance implications

```typescript
/**
 * Validation plugin - Validates state before updates
 *
 * @example
 * ```ts
 * validation({
 *   validate: (state) => state.value >= 0
 * })
 * ```
 *
 * @param options - Validation options
 * @returns ReactorPlugin instance
 */
export function validation<T extends object>(
  options: ValidationOptions<T>
): ReactorPlugin<T> {
  // ...
}
```

---

## Summary

Plugins in svelte-reactor are:

- ✅ **Powerful** - Full access to state and lifecycle
- ✅ **Composable** - Multiple plugins work together
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Testable** - Easy to unit test
- ✅ **Flexible** - Support any use case

Start with the simple examples and build up to more complex patterns as needed!

For more information, see:
- [API.md](./API.md) - Complete API reference
- [EXAMPLES.md](./EXAMPLES.md) - Real-world usage examples
- [Tests](./tests/) - Plugin test examples
