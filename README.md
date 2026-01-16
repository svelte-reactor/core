# svelte-reactor

> **Production-ready** reactive state management for Svelte 5 with full **Svelte stores API** compatibility

[![npm version](https://img.shields.io/npm/v/svelte-reactor.svg?style=flat)](https://www.npmjs.com/package/svelte-reactor)
[![npm downloads](https://img.shields.io/npm/dm/svelte-reactor.svg?style=flat)](https://www.npmjs.com/package/svelte-reactor)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/svelte-reactor?style=flat&label=gzip)](https://bundlephobia.com/package/svelte-reactor)
[![Build Status](https://github.com/svelte-reactor/core/workflows/CI/badge.svg)](https://github.com/svelte-reactor/core/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT)

**The most powerful state management for Svelte 5** - Combines the simplicity of Svelte stores with advanced features like undo/redo, persistence, and time-travel debugging.

## ✨ What's New in v0.3.0

| Feature | Description |
|---------|-------------|
| 📦 **Monorepo & Rename** | Package renamed to `@svelte-reactor/core` (legacy `svelte-reactor` still works) |
| 📝 **`createForm()` Helper** | Complete form management with sync/async validation, `useField` action |
| 🔄 **`sync` Plugin** | Renamed from `multiTabSync` for clarity |
| 🧹 **`asyncActions` Deprecated** | Use native async/await patterns instead |
| 📦 **~11.5 KB Gzipped** | Optimized bundle size |
| ✅ **617 Tests** | Comprehensive test coverage |

<details>
<summary>📜 Previous Versions</summary>

- **v0.2.9**: API cleanup - removed `.value`, simplified asyncActions, new `arrayPagination()`
- **v0.2.8**: `.value` deprecation warning, complete docs
- **v0.2.7**: `select()` method, `ReactorError` class, async concurrency control
- **v0.2.5**: Selective subscriptions, computed stores, 25% smaller bundle
- **v0.2.4**: IndexedDB storage, TTL, pagination, derived stores export
- **v0.2.3**: Selective persistence, bulk operations

</details>

📖 **Docs:** [Quick Start](./packages/core/QUICK_START.md) | [API Reference](./packages/core/API.md) | [Examples](./packages/core/EXAMPLES.md) | [Forms](./packages/core/FORMS.md)

## 🚀 Features

| Category | Features |
|----------|----------|
| **Core** | Svelte Stores Compatible (`$store`), Selective Subscriptions, Computed Stores, Derived Stores |
| **Helpers** | `simpleStore()`, `persistedStore()`, `arrayActions()`, `arrayPagination()`, `asyncActions()`, `computedStore()` |
| **Persistence** | localStorage, sessionStorage, IndexedDB (50MB+), Memory Storage, LZ Compression |
| **History** | Undo/Redo, Batch Operations, Time-Travel Debugging |
| **Sync** | Multi-Tab Sync, Cross-Tab BroadcastChannel |
| **Async** | Auto Loading/Error States, Request Cancellation, Concurrency Control |
| **Security** | Exclude Sensitive Data (`omit`/`pick`), TTL Auto-Expiration |
| **Forms** | `createForm()` helper, Sync/Async validation, `useField` action, Draft persistence |
| **DX** | AI Assistant Integration, DevTools, Rich Error Messages, 617 Tests |
| **Performance** | ~11.5 KB gzipped, Tree-Shakeable, SSR-Ready, TypeScript, Zero Dependencies |

## Installation

```bash
# Recommended: New package name
npm install @svelte-reactor/core

# Legacy (still works, re-exports @svelte-reactor/core)
npm install svelte-reactor
```

```bash
pnpm add @svelte-reactor/core
```

```bash
yarn add @svelte-reactor/core
```

## Upgrading

📖 **[View All Upgrade Guides](./UPGRADES/)**

- [**v0.3.0**](./UPGRADES/UPGRADE-0.3.0.md) - Monorepo, Forms & Cleanup (package rename to `@svelte-reactor/core`)
- [v0.2.9](./UPGRADES/UPGRADE-0.2.9.md) - API cleanup & simplification
- [v0.2.3](./UPGRADES/UPGRADE-0.2.3.md) - Feature enhancements (selective persistence, retry, bulk ops)

### 🤖 AI Assistant Setup (Optional)

Supercharge your development with AI-powered code suggestions! Run this once to configure your AI assistant:

```bash
npx svelte-reactor init-ai
```

This will generate AI instructions for:
- **Claude Code** - `.claude/README.md` (automatically read by Claude)
- **Cursor AI** - `.cursorrules` (automatically read by Cursor)
- **GitHub Copilot** - `.github/copilot-instructions.md`

Your AI assistant will then understand svelte-reactor patterns and suggest optimal code!

**Advanced options:**
```bash
# Merge with existing AI instructions
npx svelte-reactor init-ai --merge

# Overwrite existing files
npx svelte-reactor init-ai --force
```

## 📖 Quick Start

### 🎯 Simple Counter (3 lines!)

```typescript
import { simpleStore } from '@svelte-reactor/core';

export const counter = simpleStore(0);
```

```svelte
<script>
  import { counter } from './stores';
</script>

<!-- Works with $ auto-subscription! -->
<button onclick={() => counter.update(n => n + 1)}>
  Count: {$counter}
</button>
```

### 💾 Persisted Counter (Auto-saves to localStorage)

```typescript
import { persistedStore } from '@svelte-reactor/core';

// Automatically persists to localStorage
export const counter = persistedStore('counter', 0);
```

```svelte
<script>
  import { counter } from './stores';
</script>

<!-- State persists across page reloads! -->
<button onclick={() => counter.update(n => n + 1)}>
  Count: {$counter}
</button>
```

### 🔒 Secure User Store (Exclude sensitive data) - NEW in v0.2.3

```typescript
import { persistedStore } from '@svelte-reactor/core';

export const user = persistedStore('user', {
  name: 'John',
  email: 'john@example.com',
  token: 'secret_token_123',
  sessionId: 'temp_session',
  preferences: { theme: 'dark' }
}, {
  // Option 1: Only persist specific fields
  pick: ['name', 'email', 'preferences'],

  // Option 2: Exclude sensitive fields (can't use both)
  // omit: ['token', 'sessionId']
});

// Tokens never saved to localStorage - secure by default!
```

### ♻️ Advanced Store with Undo/Redo

```typescript
import { persistedReactor } from '@svelte-reactor/core';
import { undoRedo, logger } from '@svelte-reactor/core/plugins';

export const editor = persistedReactor('editor', {
  content: '',
  history: []
}, {
  additionalPlugins: [
    undoRedo({ limit: 50 }),
    logger({ collapsed: true })
  ]
});
```

```svelte
<script>
  import { editor } from './stores';
</script>

<textarea bind:value={editor.state.content}></textarea>

<button onclick={() => editor.undo()} disabled={!editor.canUndo()}>
  Undo ↩
</button>
<button onclick={() => editor.redo()} disabled={!editor.canRedo()}>
  Redo ↪
</button>
```

## 📚 API Overview

### Helper Functions (Recommended)

#### `simpleStore(initialValue, options?)`

Simple writable store compatible with Svelte's `$store` syntax.

**→ [See full example in Quick Start](./packages/core/QUICK_START.md#simple-counter-store)**

```typescript
import { simpleStore } from '@svelte-reactor/core';

const counter = simpleStore(0);
counter.subscribe(value => console.log(value));
counter.update(n => n + 1);
counter.set(5);

// Read current value (non-reactive context)
console.log(counter.get()); // 5
```

**Store Methods Quick Reference:**

| Store type | Write | Update | Read (non-reactive) | Read (reactive) |
|------------|-------|--------|---------------------|-----------------|
| `simpleStore` | `.set(val)` | `.update(fn)` | `.get()` | `$store` |
| `persistedStore` | `.set(val)` | `.update(fn)` | `.get()` | `$store` |
| `createReactor` | `.set(obj)` | `.update(fn)` | `.state` | `.state` |

#### `persistedStore(key, initialValue, options?)`

Create a store that automatically persists to localStorage, sessionStorage, or IndexedDB.

**→ [See full example in Quick Start](./packages/core/QUICK_START.md#persisted-store-auto-save-to-localstorage)**

```typescript
import { persistedStore } from '@svelte-reactor/core';

const settings = persistedStore('app-settings', { theme: 'dark' }, {
  storage: 'localStorage', // 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory'
  debounce: 300,           // Save after 300ms of inactivity

  // NEW in v0.2.3: Security options
  omit: ['user.token', 'temp'], // Exclude sensitive/temporary data
  // OR
  pick: ['theme', 'lang'],      // Only persist specific fields (can't use both)
});
```

#### `persistedReactor(key, initialState, options?)`

Full reactor API with automatic persistence and plugin support.

**→ [See full example in Quick Start](./packages/core/QUICK_START.md#full-reactor-with-undoredo)**

```typescript
import { persistedReactor } from '@svelte-reactor/core';
import { undoRedo } from '@svelte-reactor/core/plugins';

const store = persistedReactor('my-state', { count: 0 }, {
  additionalPlugins: [undoRedo()],
  omit: ['temp'], // Exclude temporary fields
});

store.update(s => { s.count++; });
store.undo(); // Undo last change
```

#### `arrayActions(reactor, field, options?)`

Simplify array management with built-in CRUD operations.

**→ [See Migration Guide](./packages/core/MIGRATION.md#working-with-arrays)**

```typescript
import { createReactor, arrayActions } from '@svelte-reactor/core';

const todos = createReactor({ items: [] });
const actions = arrayActions(todos, 'items', { idKey: 'id' });

// Simple CRUD - no manual update() needed!
actions.add({ id: '1', text: 'Buy milk', done: false, priority: 1 });
actions.update('1', { done: true });
actions.toggle('1', 'done');
actions.remove('1');

// Sorting and bulk operations
actions.sort((a, b) => a.priority - b.priority); // Sort by priority
actions.bulkUpdate(['1', '2', '3'], { done: true }); // Update multiple
actions.bulkRemove(['1', '2']); // Remove multiple
actions.bulkRemove(item => item.done); // Remove by predicate

// Query operations
const item = actions.find('1');
const count = actions.count();
```

#### `arrayPagination(reactor, field, options)` - NEW in v0.2.9

Standalone pagination helper for large arrays:

```typescript
import { createReactor, arrayPagination } from '@svelte-reactor/core';

const store = createReactor({ items: [] });
const pagination = arrayPagination(store, 'items', {
  pageSize: 20,      // Items per page
  initialPage: 1     // Starting page
});

// Get paginated data with metadata
const { items, page, totalPages, hasNext, hasPrev } = pagination.getPaginated();

// Navigation
pagination.nextPage();   // Go to next page
pagination.prevPage();   // Go to previous page
pagination.setPage(5);   // Jump to specific page
pagination.firstPage();  // Jump to first page
pagination.lastPage();   // Jump to last page
```

#### `asyncActions(reactor, actions, options?)`

Manage async operations with automatic loading and error states.

**→ [See Migration Guide](./packages/core/MIGRATION.md#async-operations--loading-states)**

```typescript
import { createReactor, asyncActions } from '@svelte-reactor/core';

const store = createReactor({
  users: [],
  loading: false,
  error: null
});

const api = asyncActions(store, {
  fetchUsers: async () => {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch');
    return { users: await response.json() };
  },
  searchUsers: async (query: string) => {
    const response = await fetch(`/api/users?q=${query}`);
    return { users: await response.json() };
  }
}, {
  // Concurrency control (v0.2.9)
  concurrency: 'replace',  // 'replace' (default) or 'queue'
  onError: (error, actionName) => console.error(`${actionName} failed:`, error)
});

// Automatic loading & error management!
await api.fetchUsers();

// Concurrency: 'replace' mode cancels previous request
api.searchUsers('hello');
api.searchUsers('world');  // Cancels 'hello', only 'world' result applies

// Manual cancellation
const controller = api.fetchUsers();
controller.cancel(); // Cancel in-flight request
```

**Retry at API layer (v0.2.9 pattern):**

```typescript
// For retry logic, wrap at the API layer:
const fetchWithRetry = async () => {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch('/api/users').then(r => r.json());
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

const api = asyncActions(store, { fetchUsers: fetchWithRetry });
```

---

### 🔗 Derived Stores

**NEW in v0.2.4:** `derived`, `get`, and `readonly` are now exported from `svelte-reactor` for convenience!

All svelte-reactor stores are 100% compatible with Svelte's store API, including `derived()` stores. You can now import everything from a single source:

```typescript
import { simpleStore, derived, get, readonly } from '@svelte-reactor/core';

// Create base stores
const firstName = simpleStore('John');
const lastName = simpleStore('Doe');

// Derive computed values
const fullName = derived(
  [firstName, lastName],
  ([$first, $last]) => `${$first} ${$last}`
);

console.log(get(fullName)); // "John Doe"

firstName.set('Jane');
console.log(get(fullName)); // "Jane Doe"

// Create readonly versions
const readonlyName = readonly(fullName);
// readonlyName has no .set() or .update() methods
```

**Real-world example - Shopping Cart:**

```typescript
import { createReactor, derived, get } from '@svelte-reactor/core';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

const cart = createReactor<{ items: CartItem[] }>({
  items: []
});

// Derive total items
const totalItems = derived(
  cart,
  $cart => $cart.items.reduce((sum, item) => sum + item.quantity, 0)
);

// Derive total price
const totalPrice = derived(
  cart,
  $cart => $cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

// Combine derived stores
const cartSummary = derived(
  [totalItems, totalPrice],
  ([$items, $price]) => `${$items} items - $${$price.toFixed(2)}`
);

// Add items to cart
cart.update(state => {
  state.items.push({ id: 1, name: 'Product A', price: 10, quantity: 2 });
});

console.log(get(cartSummary)); // "2 items - $20.00"
```

**Why use derived stores?**
- ✅ **Automatic updates** - Recomputes when dependencies change
- ✅ **Memoization** - Only recomputes when inputs change
- ✅ **Composable** - Combine multiple stores easily
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Single import** - No need to import from `svelte/store`

**Exported utilities:**
- `derived()` - Create computed stores from one or more stores
- `get()` - Get current value from any store (one-time read)
- `readonly()` - Create read-only version of a store

---

### 🎯 Selective Subscriptions with `select()`

Subscribe to specific parts of state for better performance using the `select()` method (v0.2.9):

```typescript
import { createReactor, isEqual } from '@svelte-reactor/core';

const store = createReactor({
  user: { name: 'John', age: 30 },
  count: 0
});

// select() - only fires when user.name changes
const unsubscribe = store.select(
  state => state.user.name,
  (name, prevName) => {
    console.log(`Name: ${prevName} → ${name}`);
  }
);

store.update(s => { s.count++; });            // ❌ Callback NOT called
store.update(s => { s.user.age = 31; });      // ❌ Callback NOT called
store.update(s => { s.user.name = 'Jane'; }); // ✅ Callback called!

// With options
store.select(
  state => state.items,
  (items) => console.log(items),
  {
    fireImmediately: false,  // Don't fire on subscribe
    equalityFn: isEqual      // Deep comparison for arrays/objects
  }
);

// Cleanup
unsubscribe();
```

**Why use `select()`?**
- ⚡ **Performance** - Avoid unnecessary re-renders and computations
- 🎯 **Precision** - React only to relevant state changes
- 🧩 **Composable** - Multiple selective subscriptions per store

**Real-world example - Form validation:**

```typescript
const form = createReactor({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
});

// Validate each field independently
form.select(s => s.email, validateEmail);

form.select(
  s => [s.password, s.confirmPassword],
  ([pwd, confirm]) => validatePasswordMatch(pwd, confirm),
  { equalityFn: isEqual }
);

// Changes to 'name' don't trigger email or password validation! 🎯
```

**See [EXAMPLES.md](./packages/core/EXAMPLES.md#selective-subscriptions) for more patterns**

---

### 📊 Computed Stores

Memoized computed state with dependency tracking (2-10x faster than `derived()`):

```typescript
import { createReactor, computedStore, isEqual } from '@svelte-reactor/core';

const store = createReactor({
  items: [{ id: 1, done: false }, { id: 2, done: true }],
  filter: 'all'
});

// Only recomputes when 'items' or 'filter' change
const filtered = computedStore(store, state => {
  if (state.filter === 'active') return state.items.filter(i => !i.done);
  if (state.filter === 'done') return state.items.filter(i => i.done);
  return state.items;
}, { keys: ['items', 'filter'], equals: isEqual });
```

📖 **See [EXAMPLES.md](./packages/core/EXAMPLES.md#computed-stores) for more patterns**

---

### 💾 Storage Options

| Storage | Capacity | Persistence | Use Case |
|---------|----------|-------------|----------|
| `localStorage` | 5-10 MB | Forever | Settings, preferences |
| `sessionStorage` | 5-10 MB | Tab session | Form drafts, temp data |
| `indexedDB` | 50+ MB | Forever | Large datasets, offline data |
| `memory` | Unlimited | Runtime only | Testing, SSR |

```typescript
import { persistedStore } from 'svelte-reactor';

// IndexedDB for large data (50MB+)
const photos = persistedStore('photos', { items: [] }, {
  storage: 'indexedDB',
  indexedDB: { database: 'my-app', storeName: 'photos' }
});

// TTL for auto-expiring cache
const cache = persistedStore('api-cache', { data: null }, {
  ttl: 5 * 60 * 1000,  // 5 minutes
  onExpire: () => console.log('Cache expired!')
});
```

📖 **See [API.md](./packages/core/API.md#persist) for full storage options documentation.**

---

### Core API

#### `createReactor(initialState, options?)`

Create a new reactor instance with undo/redo, middleware, and plugin support.

**Parameters:**

- `initialState: T` - Initial state object
- `options?: ReactorOptions<T>` - Optional configuration

**Options:**

```typescript
interface ReactorOptions<T> {
  // Plugin system
  plugins?: ReactorPlugin<T>[];

  // Reactor name (for DevTools)
  name?: string;

  // Enable DevTools integration
  devtools?: boolean;
}
```

**Returns:** `Reactor<T>`

```typescript
interface Reactor<T> {
  // State access
  state: T;

  // Svelte stores API (v0.2.0+)
  subscribe(subscriber: (state: T) => void): () => void;

  // Actions
  update(updater: (state: T) => void, action?: string): void;
  set(newState: Partial<T>): void;

  // Undo/Redo (available with undoRedo plugin)
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clearHistory(): void;
  getHistory(): HistoryEntry<T>[];

  // Batch operations
  batch(fn: () => void): void;

  // DevTools
  inspect(): ReactorInspection;

  // Cleanup
  destroy(): void;
}
```

## Plugins

### Built-in Plugins

#### `undoRedo(options?)`

Enable undo/redo functionality.

```typescript
import { undoRedo } from '@svelte-reactor/core/plugins';

const reactor = createReactor(initialState, {
  plugins: [
    undoRedo({
      limit: 50,                    // History limit (default: 50)
      exclude: ['skip-history'],    // Actions to exclude from history
      compress: true,                // Compress identical consecutive states
    }),
  ],
});

// Use with action names for better debugging
reactor.update(state => { state.value++; }, 'increment');
reactor.update(state => { state.temp = 123; }, 'skip-history'); // Won't add to history
```

#### `persist(options)`

Built-in state persistence with security features.

```typescript
import { persist } from '@svelte-reactor/core/plugins';

const reactor = createReactor(initialState, {
  plugins: [
    persist({
      key: 'my-state',
      storage: 'localStorage',    // or 'sessionStorage'
      debounce: 300,               // Save after 300ms

      // NEW in v0.2.0: Security options
      omit: ['user.token'],        // Exclude sensitive fields
      pick: ['settings', 'theme'], // Or only persist specific fields

      // NEW in v0.2.0: Custom serialization
      serialize: (state) => ({      // Custom save logic
        ...state,
        savedAt: Date.now()
      }),
      deserialize: (stored) => {    // Custom load logic
        const { savedAt, ...state } = stored;
        return state;
      },

      // Optional features
      compress: false,
      version: 1,
      migrations: {
        1: (old) => ({ ...old, newField: 'value' })
      },
    }),
  ],
});
```

#### `logger(options?)`

Log all state changes to console with advanced filtering.

```typescript
import { logger } from '@svelte-reactor/core/plugins';

const reactor = createReactor(initialState, {
  plugins: [
    logger({
      collapsed: true, // Collapse console groups

      // NEW in v0.2.3: Advanced filtering
      filter: (action, state, prevState) => {
        // Only log user actions
        return action?.startsWith('user:');
        // Or only log when count changes
        // return state.count !== prevState.count;
      },

      // NEW in v0.2.3: Performance tracking
      trackPerformance: true,  // Show execution time
      slowThreshold: 100,      // Warn if action takes > 100ms
      includeTimestamp: true,  // Add timestamp to logs
      maxDepth: 3,             // Limit object depth in console
    }),
  ],
});
```

## DevTools

Built-in DevTools API for time-travel debugging and state inspection:

```typescript
import { createReactor } from '@svelte-reactor/core';
import { createDevTools } from '@svelte-reactor/core/devtools';

const reactor = createReactor({ value: 0 });
const devtools = createDevTools(reactor, { name: 'MyReactor' });

// Time travel
devtools.timeTravel(5); // Jump to history index 5

// Export/Import state
const snapshot = devtools.exportState();
devtools.importState(snapshot);

// Inspect current state
const info = devtools.getStateAt(3);
console.log(info.state, info.timestamp);

// Subscribe to changes
const unsubscribe = devtools.subscribe((state) => {
  console.log('State changed:', state);
});

// Reset to initial state
devtools.reset();
```

## Middleware

Create custom middleware for advanced use cases:

```typescript
import { createReactor } from '@svelte-reactor/core';

const loggingMiddleware = {
  name: 'logger',
  onBeforeUpdate(prevState, nextState, action) {
    console.log(`[${action}] Before:`, prevState);
  },
  onAfterUpdate(prevState, nextState, action) {
    console.log(`[${action}] After:`, nextState);
  },
  onError(error) {
    console.error('Error:', error);
  },
};

const reactor = createReactor(initialState, {
  plugins: [
    {
      install: () => ({ middlewares: [loggingMiddleware] })
    }
  ],
});
```

## Performance

Reactor is highly optimized for performance:

- **Simple state update**: 26,884 ops/sec (~0.037ms)
- **Update with undo/redo**: 11,636 ops/sec (~0.086ms)
- **100 sequential updates**: 331 ops/sec (~3ms)
- **Bundle size**: 14.68 KB gzipped (full package, v0.2.4)

See [PERFORMANCE.md](./packages/core/PERFORMANCE.md) for detailed benchmarks.

## Examples

### Complete Todo App

```svelte
<script lang="ts">
  import { createReactor } from '@svelte-reactor/core';
  import { persist, undoRedo } from '@svelte-reactor/core/plugins';

  interface Todo {
    id: string;
    text: string;
    done: boolean;
  }

  const todos = createReactor(
    { items: [] as Todo[], filter: 'all' as 'all' | 'active' | 'done' },
    {
      plugins: [
        persist({ key: 'todos', debounce: 300 }),
        undoRedo({ limit: 50 }),
      ],
    }
  );

  let newTodoText = $state('');

  function addTodo() {
    if (!newTodoText.trim()) return;
    todos.update(state => {
      state.items.push({
        id: crypto.randomUUID(),
        text: newTodoText.trim(),
        done: false,
      });
    }, 'add-todo');
    newTodoText = '';
  }

  function toggleTodo(id: string) {
    todos.update(state => {
      const todo = state.items.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    }, 'toggle-todo');
  }

  function removeTodo(id: string) {
    todos.update(state => {
      state.items = state.items.filter(t => t.id !== id);
    }, 'remove-todo');
  }

  const filtered = $derived(
    todos.state.filter === 'all'
      ? todos.state.items
      : todos.state.items.filter(t =>
          todos.state.filter === 'done' ? t.done : !t.done
        )
  );
</script>

<input bind:value={newTodoText} onkeydown={e => e.key === 'Enter' && addTodo()} />
<button onclick={addTodo}>Add</button>

<div>
  <button onclick={() => todos.update(s => { s.filter = 'all'; })}>All</button>
  <button onclick={() => todos.update(s => { s.filter = 'active'; })}>Active</button>
  <button onclick={() => todos.update(s => { s.filter = 'done'; })}>Done</button>
</div>

{#each filtered as todo (todo.id)}
  <div>
    <input type="checkbox" checked={todo.done} onchange={() => toggleTodo(todo.id)} />
    <span style:text-decoration={todo.done ? 'line-through' : 'none'}>{todo.text}</span>
    <button onclick={() => removeTodo(todo.id)}>×</button>
  </div>
{/each}

<button onclick={() => todos.undo()} disabled={!todos.canUndo()}>Undo</button>
<button onclick={() => todos.redo()} disabled={!todos.canRedo()}>Redo</button>
```

## API Documentation

For complete API reference, see [API.md](./packages/core/API.md).

For more examples, see [EXAMPLES.md](./packages/core/EXAMPLES.md).

## Roadmap

**Current:** v0.3.0 (617 tests, ~11.5 KB gzipped) — See [CHANGELOG.md](./packages/core/CHANGELOG.md) for version history.

### 🔜 v0.3.1 - IndexedDB Performance & Collections (Planned)
- IndexedDB connection pooling and batch writes
- Collection support for large arrays
- Query support (preview)
- Form examples (login, registration, wizard)

### 🚀 v1.0.0 - Stable Release (Future)
- React/Vue adapters
- Redux DevTools extension
- Comprehensive ecosystem

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run benchmarks
pnpm bench

# Build
pnpm build

# Type check
pnpm typecheck
```

## Testing

The package includes comprehensive test coverage:

- **617 tests** covering all features
- Unit tests for core reactor, plugins, helpers, utilities, and DevTools
- Form integration tests with sync/async validation
- Advanced complexity tests for edge cases and concurrent operations
- Integration tests for IndexedDB, TTL, pagination, compression
- Performance benchmarks for all operations
- TypeScript type checking

Run tests with `pnpm test` or `pnpm test:watch` for development.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](https://github.com/svelte-reactor/core/blob/master/CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](./packages/core/LICENSE) for details

## Credits

Built with love for the Svelte community.
