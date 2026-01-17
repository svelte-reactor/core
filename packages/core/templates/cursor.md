# Svelte Reactor - Cursor AI Rules

## Quick Reference

**Package:** `@svelte-reactor/core` v0.3.1
**Purpose:** Reactive state management for Svelte 5 with undo/redo, persistence, forms, plugins

## Documentation Links

- [README.md](./README.md) - Overview
- [API.md](./API.md) - API reference
- [PLUGINS.md](./PLUGINS.md) - Plugins
- [EXAMPLES.md](./EXAMPLES.md) - Examples
- [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md) - Performance

## Imports

```typescript
// NEW: @svelte-reactor/core (recommended)
import { createReactor, simpleStore, persistedStore, computedStore } from '@svelte-reactor/core';
import { arrayActions, arrayPagination } from '@svelte-reactor/core';
import { derived, get, readonly, isEqual } from '@svelte-reactor/core';

// Plugins
import { undoRedo, persist, logger, sync } from '@svelte-reactor/core/plugins';

// Helpers (including forms)
import { createForm } from '@svelte-reactor/core/helpers';

// OLD: svelte-reactor (still works)
import { createReactor } from '@svelte-reactor/core';
```

## Core API

### createReactor
```typescript
const store = createReactor({ count: 0, user: null }, {
  name: 'myStore',
  plugins: [undoRedo(), persist({ key: 'app' })],
  devtools: true
});

// Methods
store.state              // Current state (reactive)
store.update(s => { s.count++; }, 'action-name')
store.set({ count: 5 })  // Merge partial
store.subscribe(state => {})
store.select(s => s.count, (val, prev) => {})
store.undo() / store.redo()
store.canUndo() / store.canRedo()
store.batch(() => { /* multiple updates */ })
store.destroy()          // IMPORTANT: cleanup
```

### simpleStore
```typescript
const count = simpleStore(0);
count.set(5);
count.update(n => n + 1);
console.log(count.get());  // Read value with .get()
const unsubscribe = count.subscribe(value => {});
```

### persistedStore
```typescript
const settings = persistedStore('key', { theme: 'dark' }, {
  storage: 'localStorage',  // 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory'
  debounce: 300,
  omit: ['sensitiveField']
});
console.log(settings.get().theme);  // ✅ Use .get() to read value
```

### Reading Values
| Store type | Read (non-reactive) | Read (reactive) |
|------------|---------------------|-----------------|
| `simpleStore` | `.get()` | `$store` |
| `persistedStore` | `.get()` | `$store` |
| `createReactor` | `.state` | `.state` |

### computedStore
```typescript
const filtered = computedStore(
  store,
  state => state.items.filter(i => !i.done),
  { keys: ['items'], equals: isEqual }
);
```

## Helpers

### arrayActions
```typescript
const actions = arrayActions(store, 'items', { idKey: 'id' });

actions.add({ id: '1', name: 'Item' });
actions.update('1', { name: 'Updated' });
actions.remove('1');
actions.toggle('1', 'done');
actions.bulkUpdate(['1', '2'], { done: true });
actions.sort((a, b) => a.priority - b.priority);
actions.find('1');
actions.has('1');
actions.count();
actions.clear();
```

### arrayPagination
```typescript
const pagination = arrayPagination(store, 'items', { pageSize: 20 });

const { items, page, totalPages, hasNext, hasPrev } = pagination.getPage();
pagination.nextPage();
pagination.prevPage();
pagination.setPage(3);
```

### asyncActions (DEPRECATED)
```typescript
const api = asyncActions(store, {
  fetchData: async (id: string) => {
    const res = await fetch(`/api/data/${id}`);
    return { data: await res.json() };
  }
}, {
  loadingKey: 'loading',
  errorKey: 'error',
  concurrency: 'replace'  // 'replace' | 'queue'
});

await api.fetchData('123');
api.fetchData.cancel();
```

### createForm (NEW v0.3.0)
```typescript
import { createForm } from '@svelte-reactor/core/helpers';

const form = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: (v) => v.includes('@') || 'Invalid email',
    password: (v) => v.length >= 8 || 'Min 8 chars'
  },
  validateAsync: {
    email: async (v) => !(await checkExists(v)) || 'Email taken'
  },
  onSubmit: async (values) => await api.login(values),
  validateOn: 'blur',       // 'change' | 'blur' | 'submit'
  persistDraft: 'login'     // Auto-save to localStorage
});

// State (reactive)
form.values / form.errors / form.touched / form.dirty
form.isValid / form.isDirty / form.isSubmitting / form.submitError

// Methods
form.setField('email', 'user@example.com');
form.setTouched('email');
await form.validate();
await form.submit();
form.reset();
form.destroy();
```

### useField action (cleaner form binding)
```svelte
<!-- Instead of bind:value + onblur, use the useField action -->
<input type="email" use:form.useField={'email'} />
<input type="password" use:form.useField={'password'} />
<input type="checkbox" use:form.useField={'rememberMe'} />
<select use:form.useField={'country'}>...</select>
<textarea use:form.useField={'message'} />
```

## Plugins

### undoRedo
```typescript
undoRedo({ limit: 50 })
```

### persist
```typescript
persist({
  key: 'app-state',
  storage: 'localStorage',   // 'localStorage' | 'sessionStorage' | 'indexedDB' | 'memory'
  pick: ['settings'],        // OR
  omit: ['user.token'],      // Exclude sensitive
  debounce: 300,
  ttl: 5 * 60 * 1000,        // Auto-expire
  onExpire: (key) => {},
  onReady: (state) => {}     // Callback when IndexedDB data loaded (v0.2.9)
})
```

### sync (multiTabSync)
```typescript
sync({ key: 'app-state', debounce: 100 })  // Sync state across browser tabs
```

### logger
```typescript
logger({
  filter: action => action?.startsWith('user:'),
  trackPerformance: true,
  slowThreshold: 16
})
```

## Selective Subscriptions

```typescript
// Only fires when selected value changes
store.select(
  state => state.user.name,
  (name, prevName) => console.log('Changed:', name),
  { fireImmediately: false, equalityFn: isEqual }
);
```

## Svelte Component Pattern

```svelte
<script lang="ts">
import { createReactor } from '@svelte-reactor/core';
import { undoRedo } from '@svelte-reactor/core/plugins';
import { onDestroy } from 'svelte';

const store = createReactor({ count: 0 }, {
  plugins: [undoRedo()]
});

onDestroy(() => store.destroy());  // REQUIRED

function increment() {
  store.update(s => { s.count++; }, 'increment');
}
</script>

<button onclick={increment}>Count: {store.state.count}</button>
<button onclick={() => store.undo()} disabled={!store.canUndo()}>Undo</button>
```

## Anti-patterns

```typescript
// WRONG: Direct mutation
store.state.count++;

// WRONG: Missing cleanup
const store = createReactor({});  // Memory leak!

// WRONG: Persisting sensitive data
persist({ key: 'auth', pick: ['token'] });  // Use omit instead

// WRONG: Not using select for specific fields
store.subscribe(s => console.log(s.user.name));  // Use select()
```

## Error Messages

Format: `[Reactor:name] message`

- `Cannot operate on destroyed reactor`
- `Storage quota exceeded in localStorage`
- `initialState must be a non-null object`
- `update() requires a function`
