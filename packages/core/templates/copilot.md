# Svelte Reactor v0.3.0 - Copilot Reference

Docs: [README](./README.md) | [API](./API.md) | [EXAMPLES](./EXAMPLES.md)

## Imports
```typescript
// NEW: @svelte-reactor/core (recommended)
import { createReactor, simpleStore, persistedStore, computedStore, arrayActions, arrayPagination, derived, get, readonly, isEqual } from '@svelte-reactor/core';
import { undoRedo, persist, logger, sync } from '@svelte-reactor/core/plugins';
import { createForm } from '@svelte-reactor/core/helpers';

// OLD: svelte-reactor (still works)
import { createReactor } from 'svelte-reactor';
```

## createReactor
```typescript
const store = createReactor({ count: 0 }, { name: 'counter', plugins: [undoRedo()], devtools: true });
store.update(s => { s.count++; }, 'increment');
store.set({ count: 5 });
store.subscribe(state => {});
store.select(s => s.count, (val, prev) => {});
store.undo(); store.redo();
store.canUndo(); store.canRedo();
store.batch(() => {});
store.destroy();
```

## simpleStore
```typescript
const count = simpleStore(0);
count.set(5);
count.update(n => n + 1);
console.log(count.get());  // Use .get() to read value
count.subscribe(val => {});
```

## persistedStore
```typescript
const settings = persistedStore('key', { theme: 'dark' }, { storage: 'localStorage', debounce: 300, omit: ['secret'] });
console.log(settings.get().theme);  // ✅ Use .get() to read value
```

## Reading Values
| Store | Read (non-reactive) | Read (reactive) |
|-------|---------------------|-----------------|
| `simpleStore/persistedStore` | `.get()` | `$store` |
| `createReactor` | `.state` | `.state` |

## computedStore
```typescript
const filtered = computedStore(store, s => s.items.filter(i => !i.done), { keys: ['items'], equals: isEqual });
```

## arrayActions
```typescript
const actions = arrayActions(store, 'items', { idKey: 'id' });
actions.add({ id: '1', name: 'Item' });
actions.update('1', { name: 'New' });
actions.remove('1');
actions.toggle('1', 'done');
actions.bulkUpdate(['1', '2'], { done: true });
actions.sort((a, b) => a.order - b.order);
```

## arrayPagination
```typescript
const pagination = arrayPagination(store, 'items', { pageSize: 20 });
const { items, page, totalPages, hasNext } = pagination.getPage();
pagination.nextPage(); pagination.prevPage(); pagination.setPage(3);
```

## createForm (NEW v0.3.0)
```typescript
import { createForm } from '@svelte-reactor/core/helpers';

const form = createForm({
  initialValues: { email: '', password: '' },
  validate: { email: v => v.includes('@') || 'Invalid', password: v => v.length >= 8 || 'Min 8' },
  validateAsync: { email: async v => !(await checkExists(v)) || 'Taken' },
  onSubmit: async (values) => await api.login(values),
  validateOn: 'blur',  // 'change' | 'blur' | 'submit'
  persistDraft: 'login'  // Auto-save to localStorage
});

// State: form.values, form.errors, form.touched, form.isValid, form.isSubmitting
// Methods: form.setField('email', 'x'), form.setTouched('email'), form.validate(), form.submit(), form.reset()

// useField action (cleaner syntax):
<input type="email" use:form.useField={'email'} />
<input type="checkbox" use:form.useField={'rememberMe'} />
```

## asyncActions (DEPRECATED)
```typescript
const api = asyncActions(store, {
  fetch: async (id: string) => { const r = await fetch(`/api/${id}`); return { data: await r.json() }; }
}, { concurrency: 'replace' });
await api.fetch('1');
api.fetch.cancel();
```

## Plugins
```typescript
undoRedo({ limit: 50 })
persist({ key: 'app', storage: 'localStorage', omit: ['token'], ttl: 300000, onExpire: () => {}, onReady: (state) => {} })
sync({ key: 'app', debounce: 100 })  // Multi-tab sync
logger({ filter: a => a?.startsWith('user:'), performance: true })  // trackPerformance renamed to performance
```

## Selective Subscribe
```typescript
store.select(s => s.user.name, (name, prev) => {}, { fireImmediately: false, equalityFn: isEqual });
```

## Svelte Component
```svelte
<script lang="ts">
import { createReactor } from '@svelte-reactor/core';
import { onDestroy } from 'svelte';
const store = createReactor({ count: 0 });
onDestroy(() => store.destroy());
</script>
<button onclick={() => store.update(s => { s.count++; })}>
  {store.state.count}
</button>
```

## Svelte Form Component
```svelte
<script lang="ts">
import { createForm } from '@svelte-reactor/core/helpers';
const form = createForm({ initialValues: { email: '' }, validate: { email: v => v.includes('@') || 'Invalid' } });
</script>
<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <input bind:value={form.values.email} onblur={() => form.setTouched('email')} />
  {#if form.touched.email && form.errors.email}<span>{form.errors.email}</span>{/if}
  <button disabled={!form.isValid}>Submit</button>
</form>
```

## Rules
- Always call `store.destroy()` or `form.destroy()` in `onDestroy`
- Use `store.update(fn)` not direct mutation
- Use `omit` for sensitive data in persist
- Use `select()` for specific field subscriptions
- NEW: Use `@svelte-reactor/core` for new projects
