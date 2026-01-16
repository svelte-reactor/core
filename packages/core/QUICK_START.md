# 🚀 Quick Start Guide

## Installation

```bash
# Recommended (v0.3.0+)
npm install @svelte-reactor/core

# Or use the legacy package name (still works)
npm install svelte-reactor
```

## Basic Usage

### Simple Counter Store

```typescript
import { simpleStore } from '@svelte-reactor/core';

// Create a simple writable store
export const counter = simpleStore(0);

// Use in component
counter.subscribe(value => console.log(value)); // 0
counter.update(n => n + 1);

// ✅ CORRECT: Use .get() to read current value (non-reactive context)
console.log(counter.get()); // 1

// ❌ DEPRECATED: Don't use .value (shows deprecation warning)
// console.log(counter.value); // Works but deprecated
```

**Reading Values - Quick Reference:**

| Store type | Read (non-reactive) | Read (reactive) |
|------------|---------------------|-----------------|
| `simpleStore` | `.get()` | `$store` |
| `persistedStore` | `.get()` | `$store` |
| `createReactor` | `.state` | `.state` |

### Persisted Store (Auto-save to localStorage)

```typescript
import { persistedStore } from '@svelte-reactor/core';

// Simple persisted counter
export const counter = persistedStore('counter', 0);

// With options
export const settings = persistedStore('app-settings', { theme: 'dark' }, {
  storage: 'localStorage',
  debounce: 300, // Save after 300ms of inactivity
  omit: ['user.token'], // Don't persist sensitive data
});
```

### Full Reactor with Undo/Redo

```typescript
import { createReactor } from '@svelte-reactor/core';
import { undoRedo, logger } from '@svelte-reactor/core/plugins';

const store = createReactor(
  { count: 0, name: 'John' },
  {
    plugins: [
      undoRedo({ limit: 50 }),
      logger({ collapsed: true })
    ]
  }
);

// Subscribe to changes (Svelte stores compatible!)
store.subscribe(state => console.log(state));

// Update state
store.update(state => { state.count++; });

// Undo/Redo
store.undo();
store.redo();
```

## Svelte Component Usage

### With $state Auto-subscription

```svelte
<script>
  import { counter } from './stores';

  // Auto-subscribe with $
  $: count = $counter;
</script>

<button onclick={() => counter.update(n => n + 1)}>
  Count: {count}
</button>
```

### With Manual Subscription

```svelte
<script>
  import { onMount } from 'svelte';
  import { counter } from './stores';

  let count = 0;

  onMount(() => {
    const unsubscribe = counter.subscribe(value => {
      count = value;
    });

    return unsubscribe;
  });
</script>

<button onclick={() => counter.update(n => n + 1)}>
  Count: {count}
</button>
```

### With Runes (Svelte 5)

```svelte
<script>
  import { createReactor } from '@svelte-reactor/core';

  const store = createReactor({ count: 0 });

  // Use reactive state directly
  let count = $derived(store.state.count);
</script>

<button onclick={() => store.update(s => { s.count++; })}>
  Count: {count}
</button>
```

## Advanced Features

### Selective Persistence (Security)

```typescript
import { persistedStore } from '@svelte-reactor/core';

const userStore = persistedStore('user', {
  name: 'John',
  email: 'john@example.com',
  token: 'secret123',
  sessionId: 'temp456'
}, {
  // Only persist name and email, exclude sensitive data
  omit: ['token', 'sessionId']
});
```

### Custom Serialization

```typescript
const store = persistedStore('data', initialValue, {
  serialize: (state) => {
    // Custom serialization logic
    return {
      ...state,
      timestamp: Date.now()
    };
  },
  deserialize: (stored) => {
    // Custom deserialization logic
    const { timestamp, ...rest } = stored;
    console.log('Loaded from:', new Date(timestamp));
    return rest;
  }
});
```

### Non-Svelte Context (onChange callback)

```typescript
import { createReactor } from '@svelte-reactor/core';

// Use in plain JavaScript/TypeScript (no Svelte needed)
const store = createReactor(
  { count: 0 },
  {
    onChange: (state, prevState, action) => {
      console.log('Changed:', prevState.count, '→', state.count);
    }
  }
);

store.update(s => { s.count++; });
```

### SSR-Safe (Server-Side Rendering)

```typescript
import { persistedStore } from '@svelte-reactor/core';

// Automatically handles SSR - persistence disabled on server
export const settings = persistedStore('settings', { theme: 'dark' });

// Works on both server and client!
```

## Examples

### Todo List

```typescript
import { persistedReactor } from '@svelte-reactor/core';
import { undoRedo } from '@svelte-reactor/core/plugins';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export const todos = persistedReactor(
  'todos',
  { items: [] as Todo[], nextId: 1 },
  {
    additionalPlugins: [undoRedo({ limit: 20 })],
  }
);

// Add todo
export function addTodo(text: string) {
  todos.update(state => {
    state.items.push({
      id: state.nextId++,
      text,
      done: false
    });
  });
}

// Toggle todo
export function toggleTodo(id: number) {
  todos.update(state => {
    const todo = state.items.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  });
}
```

### Form Management (NEW in v0.3.0)

```typescript
import { createForm } from '@svelte-reactor/core/helpers';

// Create a reactive form with validation
const form = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: [
      (v) => !!v || 'Email is required',
      (v) => v.includes('@') || 'Invalid email'
    ],
    password: (v) => v.length >= 6 || 'Min 6 characters'
  },
  onSubmit: async (values) => {
    await api.login(values);
  },
  validateOn: 'blur',
  persistDraft: 'login-form' // Auto-save draft to localStorage
});

// Usage
form.setField('email', 'user@example.com');
await form.validate();
await form.submit();
form.reset();
```

**In Svelte component:**

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';

  const form = createForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => v.includes('@') || 'Invalid email',
      password: (v) => v.length >= 6 || 'Min 6 characters'
    },
    onSubmit: async (values) => await login(values)
  });
</script>

<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <input
    type="email"
    bind:value={form.values.email}
    onblur={() => form.setTouched('email')}
  />
  {#if form.touched.email && form.errors.email}
    <span class="error">{form.errors.email}</span>
  {/if}

  <button disabled={!form.isValid || form.isSubmitting}>
    {form.isSubmitting ? 'Loading...' : 'Submit'}
  </button>
</form>
```

**Using useField action (cleaner syntax):**

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';

  const form = createForm({
    initialValues: { email: '', password: '', rememberMe: false },
    validate: {
      email: (v) => v.includes('@') || 'Invalid email',
      password: (v) => v.length >= 6 || 'Min 6 characters'
    },
    onSubmit: async (values) => await login(values)
  });
</script>

<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <!-- useField action auto-handles binding and touch -->
  <input type="email" use:form.useField={'email'} />
  <input type="password" use:form.useField={'password'} />
  <input type="checkbox" use:form.useField={'rememberMe'} /> Remember me

  <button disabled={!form.isValid || form.isSubmitting}>Submit</button>
</form>
```

## API Comparison

| Feature | simpleStore | persistedStore | createReactor |
|---------|-------------|----------------|---------------|
| Svelte stores API | ✅ | ✅ | ✅ |
| subscribe() | ✅ | ✅ | ✅ |
| Persistence | ❌ | ✅ | Via plugin |
| Undo/Redo | ❌ | ❌ | Via plugin |
| Middleware | ❌ | ❌ | ✅ |
| History tracking | ❌ | ❌ | ✅ |
| DevTools | ❌ | ❌ | ✅ |

## Next Steps

**📚 Comprehensive Guides:**
- 📝 [Form Helper Guide](./FORMS.md) - Complete createForm() documentation (NEW in v0.3.0)
- 📖 [Plugin Development Guide](./PLUGINS.md) - Create custom plugins with 4 working examples
- 🚀 [Performance Optimization Guide](./PERFORMANCE_GUIDE.md) - Optimization strategies with 5 demos
- 🛡️ [Error Handling Guide](./ERROR_HANDLING.md) - Error patterns with 20 examples

**📖 Core Documentation:**
- [Full API Reference](./API.md) - Complete API documentation
- [Migration Guide](./MIGRATION.md) - Migrate from other state libraries
- [Upgrade to v0.3.0](../../UPGRADES/UPGRADE-0.3.0.md) - Migration guide for v0.3.0
- [Examples](../../examples) - Real-world usage examples
