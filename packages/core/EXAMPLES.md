# Examples

Real-world examples and patterns for using svelte-reactor.

## Table of Contents

- [Basic Examples](#basic-examples)
  - [Counter with Undo/Redo](#counter-with-undoredo)
  - [Form State Management](#form-state-management)
  - [Settings Panel](#settings-panel)
- [Advanced Examples](#advanced-examples)
  - [Todo App with Persistence](#todo-app-with-persistence)
  - [Shopping Cart](#shopping-cart)
  - [Canvas Editor](#canvas-editor)
- [Patterns](#patterns)
  - [Selective Subscriptions](#selective-subscriptions) ✨ NEW in v0.2.5
  - [Custom Middleware](#custom-middleware)
  - [Derived State](#derived-state)
  - [Action Tracking](#action-tracking)
  - [State Migrations](#state-migrations)

---

## Basic Examples

### Counter with Undo/Redo

Simple counter with full undo/redo support.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { undoRedo } from 'svelte-reactor/plugins';

  const counter = createReactor(
    { value: 0, step: 1 },
    {
      plugins: [undoRedo({ limit: 50 })],
    }
  );

  function increment() {
    counter.update(state => {
      state.value += state.step;
    }, 'increment');
  }

  function decrement() {
    counter.update(state => {
      state.value -= state.step;
    }, 'decrement');
  }

  function setStep(step: number) {
    counter.update(state => {
      state.step = step;
    }, 'set-step');
  }
</script>

<div>
  <h2>Counter: {counter.state.value}</h2>

  <div>
    <button onclick={decrement}>-</button>
    <button onclick={increment}>+</button>
  </div>

  <div>
    Step:
    <button onclick={() => setStep(1)}>1</button>
    <button onclick={() => setStep(5)}>5</button>
    <button onclick={() => setStep(10)}>10</button>
  </div>

  <div>
    <button onclick={() => counter.undo()} disabled={!counter.canUndo()}>
      Undo
    </button>
    <button onclick={() => counter.redo()} disabled={!counter.canRedo()}>
      Redo
    </button>
  </div>
</div>
```

---

### Form State Management

Manage complex form state with validation.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { undoRedo } from 'svelte-reactor/plugins';

  interface FormState {
    name: string;
    email: string;
    age: number;
    errors: {
      name?: string;
      email?: string;
      age?: string;
    };
  }

  const form = createReactor<FormState>(
    {
      name: '',
      email: '',
      age: 0,
      errors: {},
    },
    {
      plugins: [undoRedo()],
    }
  );

  function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function updateField(field: keyof Omit<FormState, 'errors'>, value: any) {
    form.update(state => {
      state[field] = value;

      // Clear error for this field
      delete state.errors[field as keyof FormState['errors']];
    }, `update-${field}`);
  }

  function validate() {
    form.update(state => {
      state.errors = {};

      if (!state.name) {
        state.errors.name = 'Name is required';
      }

      if (!validateEmail(state.email)) {
        state.errors.email = 'Invalid email';
      }

      if (state.age < 18) {
        state.errors.age = 'Must be 18 or older';
      }
    }, 'validate');
  }

  const hasErrors = $derived(Object.keys(form.state.errors).length > 0);
</script>

<form onsubmit|preventDefault={validate}>
  <div>
    <label>
      Name:
      <input
        type="text"
        value={form.state.name}
        oninput={(e) => updateField('name', e.currentTarget.value)}
      />
      {#if form.state.errors.name}
        <span class="error">{form.state.errors.name}</span>
      {/if}
    </label>
  </div>

  <div>
    <label>
      Email:
      <input
        type="email"
        value={form.state.email}
        oninput={(e) => updateField('email', e.currentTarget.value)}
      />
      {#if form.state.errors.email}
        <span class="error">{form.state.errors.email}</span>
      {/if}
    </label>
  </div>

  <div>
    <label>
      Age:
      <input
        type="number"
        value={form.state.age}
        oninput={(e) => updateField('age', parseInt(e.currentTarget.value))}
      />
      {#if form.state.errors.age}
        <span class="error">{form.state.errors.age}</span>
      {/if}
    </label>
  </div>

  <button type="submit">Submit</button>
  <button type="button" onclick={() => form.undo()} disabled={!form.canUndo()}>
    Undo
  </button>
</form>

<style>
  .error {
    color: red;
    font-size: 0.9em;
  }
</style>
```

---

### Settings Panel

Persistent settings with localStorage.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { persist } from 'svelte-reactor/plugins';

  interface Settings {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
    fontSize: number;
  }

  const settings = createReactor<Settings>(
    {
      theme: 'light',
      notifications: true,
      language: 'en',
      fontSize: 16,
    },
    {
      plugins: [
        persist({
          key: 'app-settings',
          debounce: 500,
        }),
      ],
    }
  );

  function toggleTheme() {
    settings.update(state => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    }, 'toggle-theme');
  }

  function setFontSize(size: number) {
    settings.update(state => {
      state.fontSize = Math.max(12, Math.min(24, size));
    }, 'set-font-size');
  }
</script>

<div class={settings.state.theme}>
  <h2>Settings</h2>

  <div>
    <label>
      Theme:
      <button onclick={toggleTheme}>
        {settings.state.theme === 'light' ? '🌙' : '☀️'}
      </button>
    </label>
  </div>

  <div>
    <label>
      <input
        type="checkbox"
        checked={settings.state.notifications}
        onchange={(e) => settings.update(s => {
          s.notifications = e.currentTarget.checked;
        }, 'toggle-notifications')}
      />
      Enable notifications
    </label>
  </div>

  <div>
    <label>
      Language:
      <select
        value={settings.state.language}
        onchange={(e) => settings.update(s => {
          s.language = e.currentTarget.value;
        }, 'change-language')}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
      </select>
    </label>
  </div>

  <div>
    <label>
      Font size: {settings.state.fontSize}px
      <input
        type="range"
        min="12"
        max="24"
        value={settings.state.fontSize}
        oninput={(e) => setFontSize(parseInt(e.currentTarget.value))}
      />
    </label>
  </div>
</div>

<style>
  .light {
    background: white;
    color: black;
  }
  .dark {
    background: #1a1a1a;
    color: white;
  }
</style>
```

---

## Advanced Examples

### Todo App with Persistence

Complete todo app with categories, filters, and persistence.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { persist, undoRedo } from 'svelte-reactor/plugins';

  interface Todo {
    id: string;
    text: string;
    done: boolean;
    category: string;
    createdAt: number;
  }

  interface TodoState {
    items: Todo[];
    filter: 'all' | 'active' | 'done';
    category: string;
    categories: string[];
  }

  const todos = createReactor<TodoState>(
    {
      items: [],
      filter: 'all',
      category: 'all',
      categories: ['Work', 'Personal', 'Shopping'],
    },
    {
      plugins: [
        persist({ key: 'todos-v2', debounce: 300 }),
        undoRedo({ limit: 100 }),
      ],
    }
  );

  let newTodoText = $state('');
  let selectedCategory = $state('Work');

  function addTodo() {
    if (!newTodoText.trim()) return;

    todos.update(state => {
      state.items.push({
        id: crypto.randomUUID(),
        text: newTodoText.trim(),
        done: false,
        category: selectedCategory,
        createdAt: Date.now(),
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

  function clearCompleted() {
    todos.update(state => {
      state.items = state.items.filter(t => !t.done);
    }, 'clear-completed');
  }

  function addCategory(name: string) {
    todos.update(state => {
      if (!state.categories.includes(name)) {
        state.categories.push(name);
      }
    }, 'add-category');
  }

  const filtered = $derived(() => {
    let items = todos.state.items;

    // Filter by status
    if (todos.state.filter === 'active') {
      items = items.filter(t => !t.done);
    } else if (todos.state.filter === 'done') {
      items = items.filter(t => t.done);
    }

    // Filter by category
    if (todos.state.category !== 'all') {
      items = items.filter(t => t.category === todos.state.category);
    }

    return items.sort((a, b) => b.createdAt - a.createdAt);
  });

  const stats = $derived({
    total: todos.state.items.length,
    active: todos.state.items.filter(t => !t.done).length,
    done: todos.state.items.filter(t => t.done).length,
  });
</script>

<div class="todo-app">
  <h1>Todo App</h1>

  <div class="add-todo">
    <input
      bind:value={newTodoText}
      placeholder="What needs to be done?"
      onkeydown={(e) => e.key === 'Enter' && addTodo()}
    />
    <select bind:value={selectedCategory}>
      {#each todos.state.categories as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>
    <button onclick={addTodo}>Add</button>
  </div>

  <div class="filters">
    <button
      class:active={todos.state.filter === 'all'}
      onclick={() => todos.update(s => { s.filter = 'all'; })}
    >
      All ({stats.total})
    </button>
    <button
      class:active={todos.state.filter === 'active'}
      onclick={() => todos.update(s => { s.filter = 'active'; })}
    >
      Active ({stats.active})
    </button>
    <button
      class:active={todos.state.filter === 'done'}
      onclick={() => todos.update(s => { s.filter = 'done'; })}
    >
      Done ({stats.done})
    </button>
  </div>

  <div class="categories">
    <button
      class:active={todos.state.category === 'all'}
      onclick={() => todos.update(s => { s.category = 'all'; })}
    >
      All Categories
    </button>
    {#each todos.state.categories as cat}
      <button
        class:active={todos.state.category === cat}
        onclick={() => todos.update(s => { s.category = cat; })}
      >
        {cat}
      </button>
    {/each}
  </div>

  <ul class="todo-list">
    {#each filtered() as todo (todo.id)}
      <li class:done={todo.done}>
        <input
          type="checkbox"
          checked={todo.done}
          onchange={() => toggleTodo(todo.id)}
        />
        <span>{todo.text}</span>
        <span class="category">{todo.category}</span>
        <button onclick={() => removeTodo(todo.id)}>×</button>
      </li>
    {/each}
  </ul>

  <div class="actions">
    <button onclick={clearCompleted} disabled={stats.done === 0}>
      Clear Completed
    </button>
    <button onclick={() => todos.undo()} disabled={!todos.canUndo()}>
      Undo
    </button>
    <button onclick={() => todos.redo()} disabled={!todos.canRedo()}>
      Redo
    </button>
  </div>
</div>

<style>
  .todo-app {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .add-todo {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .add-todo input {
    flex: 1;
  }

  .filters, .categories {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .filters button.active,
  .categories button.active {
    background: #4CAF50;
    color: white;
  }

  .todo-list {
    list-style: none;
    padding: 0;
  }

  .todo-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
  }

  .todo-list li.done span {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .category {
    font-size: 0.8em;
    background: #eee;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    margin-left: auto;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
```

---

### Shopping Cart

Shopping cart with quantity management and persistence.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { persist, undoRedo } from 'svelte-reactor/plugins';

  interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }

  interface CartState {
    items: CartItem[];
    discount: number;
  }

  const cart = createReactor<CartState>(
    {
      items: [],
      discount: 0,
    },
    {
      plugins: [
        persist({ key: 'shopping-cart', debounce: 500 }),
        undoRedo({ limit: 50 }),
      ],
    }
  );

  function addItem(id: string, name: string, price: number) {
    cart.update(state => {
      const existing = state.items.find(item => item.id === id);
      if (existing) {
        existing.quantity++;
      } else {
        state.items.push({ id, name, price, quantity: 1 });
      }
    }, 'add-item');
  }

  function removeItem(id: string) {
    cart.update(state => {
      state.items = state.items.filter(item => item.id !== id);
    }, 'remove-item');
  }

  function updateQuantity(id: string, quantity: number) {
    cart.update(state => {
      const item = state.items.find(i => i.id === id);
      if (item) {
        item.quantity = Math.max(1, quantity);
      }
    }, 'update-quantity');
  }

  function applyDiscount(percent: number) {
    cart.update(state => {
      state.discount = Math.max(0, Math.min(100, percent));
    }, 'apply-discount');
  }

  const subtotal = $derived(
    cart.state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  const total = $derived(
    subtotal * (1 - cart.state.discount / 100)
  );

  const itemCount = $derived(
    cart.state.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // Sample products
  const products = [
    { id: '1', name: 'Laptop', price: 999 },
    { id: '2', name: 'Mouse', price: 29 },
    { id: '3', name: 'Keyboard', price: 79 },
    { id: '4', name: 'Monitor', price: 299 },
  ];
</script>

<div class="shop">
  <h2>Products</h2>
  <div class="products">
    {#each products as product}
      <div class="product">
        <h3>{product.name}</h3>
        <p>${product.price}</p>
        <button onclick={() => addItem(product.id, product.name, product.price)}>
          Add to Cart
        </button>
      </div>
    {/each}
  </div>

  <h2>Cart ({itemCount} items)</h2>
  {#if cart.state.items.length === 0}
    <p>Cart is empty</p>
  {:else}
    <ul class="cart-items">
      {#each cart.state.items as item (item.id)}
        <li>
          <span>{item.name}</span>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onchange={(e) => updateQuantity(item.id, parseInt(e.currentTarget.value))}
          />
          <span>${(item.price * item.quantity).toFixed(2)}</span>
          <button onclick={() => removeItem(item.id)}>Remove</button>
        </li>
      {/each}
    </ul>

    <div class="totals">
      <div>Subtotal: ${subtotal.toFixed(2)}</div>

      <div>
        Discount:
        <input
          type="number"
          min="0"
          max="100"
          value={cart.state.discount}
          onchange={(e) => applyDiscount(parseInt(e.currentTarget.value))}
        />%
      </div>

      <div class="total">Total: ${total.toFixed(2)}</div>
    </div>

    <div class="actions">
      <button onclick={() => cart.undo()} disabled={!cart.canUndo()}>
        Undo
      </button>
      <button onclick={() => cart.redo()} disabled={!cart.canRedo()}>
        Redo
      </button>
      <button onclick={() => cart.update(s => { s.items = []; s.discount = 0; }, 'clear-cart')}>
        Clear Cart
      </button>
    </div>
  {/if}
</div>

<style>
  .products {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .product {
    border: 1px solid #ddd;
    padding: 1rem;
    border-radius: 4px;
  }

  .cart-items {
    list-style: none;
    padding: 0;
  }

  .cart-items li {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
  }

  .cart-items input {
    width: 60px;
  }

  .totals {
    margin: 1rem 0;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .total {
    font-size: 1.2em;
    font-weight: bold;
    margin-top: 0.5rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
```

---

### Canvas Editor

Simple drawing app with undo/redo.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { undoRedo } from 'svelte-reactor/plugins';

  interface Point {
    x: number;
    y: number;
  }

  interface Stroke {
    id: string;
    points: Point[];
    color: string;
    width: number;
  }

  const canvas = createReactor(
    {
      strokes: [] as Stroke[],
      currentColor: '#000000',
      currentWidth: 2,
    },
    {
      plugins: [undoRedo({ limit: 100 })],
    }
  );

  let drawing = $state(false);
  let currentStroke: Stroke | null = $state(null);

  function startDrawing(e: MouseEvent) {
    drawing = true;
    currentStroke = {
      id: crypto.randomUUID(),
      points: [{ x: e.offsetX, y: e.offsetY }],
      color: canvas.state.currentColor,
      width: canvas.state.currentWidth,
    };
  }

  function draw(e: MouseEvent) {
    if (!drawing || !currentStroke) return;

    currentStroke.points.push({
      x: e.offsetX,
      y: e.offsetY,
    });
  }

  function stopDrawing() {
    if (currentStroke && currentStroke.points.length > 1) {
      canvas.update(state => {
        state.strokes.push(currentStroke!);
      }, 'add-stroke');
    }
    drawing = false;
    currentStroke = null;
  }

  function clear() {
    canvas.update(state => {
      state.strokes = [];
    }, 'clear');
  }

  // Render canvas
  let canvasEl: HTMLCanvasElement;
  $effect(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d')!;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Draw all strokes
    canvas.state.strokes.forEach(stroke => {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      stroke.points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });

    // Draw current stroke
    if (currentStroke && currentStroke.points.length > 1) {
      ctx.strokeStyle = currentStroke.color;
      ctx.lineWidth = currentStroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      currentStroke.points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    }
  });
</script>

<div class="canvas-editor">
  <div class="toolbar">
    <label>
      Color:
      <input
        type="color"
        value={canvas.state.currentColor}
        oninput={(e) => canvas.update(s => {
          s.currentColor = e.currentTarget.value;
        })}
      />
    </label>

    <label>
      Width:
      <input
        type="range"
        min="1"
        max="20"
        value={canvas.state.currentWidth}
        oninput={(e) => canvas.update(s => {
          s.currentWidth = parseInt(e.currentTarget.value);
        })}
      />
      {canvas.state.currentWidth}px
    </label>

    <button onclick={clear}>Clear</button>
    <button onclick={() => canvas.undo()} disabled={!canvas.canUndo()}>
      Undo
    </button>
    <button onclick={() => canvas.redo()} disabled={!canvas.canRedo()}>
      Redo
    </button>
  </div>

  <canvas
    bind:this={canvasEl}
    width={800}
    height={600}
    onmousedown={startDrawing}
    onmousemove={draw}
    onmouseup={stopDrawing}
    onmouseleave={stopDrawing}
  />
</div>

<style>
  .canvas-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  canvas {
    border: 2px solid #333;
    cursor: crosshair;
  }
</style>
```

---

## Patterns

### Selective Subscriptions

**NEW in v0.2.5** - Subscribe to specific parts of state for better performance.

#### Pattern 1: Form Field Validation

Only validate fields that actually changed.

```typescript
import { createReactor, isEqual } from 'svelte-reactor';

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  errors: Record<string, string>;
}

const form = createReactor<FormState>({
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  errors: {}
});

// Validate email only when it changes
form.subscribe({
  selector: state => state.email,
  onChanged: (email) => {
    if (!email.includes('@')) {
      form.update(s => { s.errors.email = 'Invalid email'; });
    } else {
      form.update(s => { delete s.errors.email; });
    }
  }
});

// Validate password match only when passwords change
form.subscribe({
  selector: state => [state.password, state.confirmPassword],
  onChanged: ([pwd, confirm]) => {
    if (pwd !== confirm) {
      form.update(s => { s.errors.password = 'Passwords do not match'; });
    } else {
      form.update(s => { delete s.errors.password; });
    }
  },
  equalityFn: isEqual  // Deep comparison for array
});

// Name changes don't trigger email or password validation! ⚡
```

#### Pattern 2: Component Performance Optimization

React only to specific state changes in components.

```svelte
<script lang="ts">
  import { createReactor } from 'svelte-reactor';
  import { onMount } from 'svelte';

  interface AppState {
    user: { name: string; avatar: string };
    posts: Post[];
    notifications: number;
    theme: 'light' | 'dark';
  }

  export let store: Reactor<AppState>;

  // User profile component only cares about user data
  let userName = $state('');
  let userAvatar = $state('');

  onMount(() => {
    // Subscribe only to user changes
    const unsubscribe = store.subscribe({
      selector: state => state.user,
      onChanged: (user) => {
        userName = user.name;
        userAvatar = user.avatar;
      }
    });

    return unsubscribe;
  });

  // Posts/notifications/theme changes don't re-render this component! ⚡
</script>

<div class="user-profile">
  <img src={userAvatar} alt={userName} />
  <h3>{userName}</h3>
</div>
```

#### Pattern 3: Derived Computations

Compute expensive derived values only when dependencies change.

```typescript
import { createReactor } from 'svelte-reactor';

interface AnalyticsState {
  events: Event[];
  config: Config;
  metadata: Metadata;
}

const analytics = createReactor<AnalyticsState>({
  events: [],
  config: {},
  metadata: {}
});

// Expensive computation - only run when events change
analytics.subscribe({
  selector: state => state.events,
  onChanged: (events) => {
    // Expensive aggregation
    const stats = computeStatistics(events);
    const trends = analyzeTrends(events);
    updateDashboard(stats, trends);
  }
});

// Config/metadata changes don't trigger expensive recomputation! ⚡
```

#### Pattern 4: Multiple Independent Subscriptions

Monitor different parts of state independently.

```typescript
const store = createReactor({
  auth: { user: null, token: '' },
  ui: { sidebar: 'open', theme: 'dark' },
  data: { items: [], loading: false }
});

// Auth subscription
store.subscribe({
  selector: state => state.auth.user,
  onChanged: (user) => {
    if (user) {
      initializeUserSession(user);
    } else {
      cleanupUserSession();
    }
  }
});

// UI subscription
store.subscribe({
  selector: state => state.ui.theme,
  onChanged: (theme) => {
    document.body.className = theme;
  }
});

// Data subscription
store.subscribe({
  selector: state => state.data.loading,
  onChanged: (loading) => {
    if (loading) showSpinner();
    else hideSpinner();
  }
});

// Each subscription is independent and only fires when relevant! 🎯
```

#### Pattern 5: Debounced Updates with fireImmediately

Control when validation/updates should happen.

```typescript
// Don't validate on mount, only on actual changes
form.subscribe({
  selector: state => state.email,
  onChanged: (email) => validateEmail(email),
  fireImmediately: false  // Wait for user input
});

// Do show initial notification count
store.subscribe({
  selector: state => state.notifications,
  onChanged: (count) => updateBadge(count),
  fireImmediately: true  // Show count immediately (default)
});
```

**Performance tips:**
- ⚡ Use selective subscriptions for expensive operations
- 🎯 Prefer multiple selective subscriptions over one "watch all" subscription
- 🔍 Use `isEqual` for deep comparison of arrays/objects
- ⏱️ Set `fireImmediately: false` for validation/effects that shouldn't run on mount

---

### Computed Stores

**NEW in v0.2.5** - Memoized computed state with dependency tracking for maximum performance.

#### Pattern 1: Todo List with Filters

Efficiently filter large lists without unnecessary recomputations.

```typescript
import { createReactor, computedStore, isEqual } from 'svelte-reactor';

interface Todo {
  id: number;
  text: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
}

const store = createReactor({
  todos: [] as Todo[],
  filter: 'all' as 'all' | 'active' | 'completed',
  searchQuery: '',
  sortBy: 'priority' as 'priority' | 'text'
});

// Computed filtered & sorted todos
// Only recomputes when todos, filter, searchQuery, or sortBy change
const filteredTodos = computedStore(
  store,
  state => {
    let result = state.todos;

    // Filter by completion status
    if (state.filter === 'active') {
      result = result.filter(t => !t.done);
    } else if (state.filter === 'completed') {
      result = result.filter(t => t.done);
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      result = result.filter(t =>
        t.text.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    if (state.sortBy === 'priority') {
      const priorityMap = { high: 0, medium: 1, low: 2 };
      result = [...result].sort((a, b) =>
        priorityMap[a.priority] - priorityMap[b.priority]
      );
    } else {
      result = [...result].sort((a, b) =>
        a.text.localeCompare(b.text)
      );
    }

    return result;
  },
  {
    keys: ['todos', 'filter', 'searchQuery', 'sortBy'],
    equals: isEqual  // Deep comparison
  }
);

// In Svelte component
$: todos = $filteredTodos;  // Efficiently reactive!

// Performance: updating unrelated state doesn't trigger recomputation
store.update(s => { s.metadata = { lastSync: Date.now() }; });
// ✅ filteredTodos NOT recomputed (metadata not in keys)
```

#### Pattern 2: Shopping Cart with Pricing

Calculate totals efficiently with dependency tracking.

```typescript
import { createReactor, computedStore } from 'svelte-reactor';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  taxable: boolean;
}

const cart = createReactor({
  items: [] as CartItem[],
  discount: 0,      // 0-1 (0% to 100%)
  taxRate: 0.08,    // 8% tax
  shippingCost: 0,
  currency: 'USD',
  metadata: {
    customerId: '123',
    sessionId: 'abc',
    lastModified: Date.now()
  }
});

// Computed subtotal
const subtotal = computedStore(
  cart,
  state => state.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ),
  { keys: ['items'] }
);

// Computed tax
const tax = computedStore(
  cart,
  state => {
    const taxableAmount = state.items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    return taxableAmount * state.taxRate;
  },
  { keys: ['items', 'taxRate'] }
);

// Computed total
const total = computedStore(
  cart,
  state => {
    const sub = state.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const afterDiscount = sub * (1 - state.discount);
    const taxableAmount = state.items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = taxableAmount * state.taxRate;
    return afterDiscount + taxAmount + state.shippingCost;
  },
  { keys: ['items', 'discount', 'taxRate', 'shippingCost'] }
);

// In Svelte component
$: subtotalPrice = $subtotal;
$: taxAmount = $tax;
$: totalPrice = $total;

// Updating metadata doesn't trigger any recomputations! 🚀
cart.update(s => {
  s.metadata.lastModified = Date.now();
  s.metadata.sessionId = 'xyz';
});
```

#### Pattern 3: Dashboard with Multiple Computed Metrics

Build complex dashboards with efficient computations.

```typescript
import { createReactor, computedStore } from 'svelte-reactor';

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

const dashboard = createReactor({
  salesData: [] as SalesData[],
  dateRange: { start: '2024-01-01', end: '2024-12-31' },
  comparisonPeriod: 'previous' as 'previous' | 'year-ago',
  currency: 'USD',
  theme: 'light'
});

// Total revenue (only recomputes when salesData or dateRange changes)
const totalRevenue = computedStore(
  dashboard,
  state => {
    const filtered = state.salesData.filter(d =>
      d.date >= state.dateRange.start && d.date <= state.dateRange.end
    );
    return filtered.reduce((sum, d) => sum + d.revenue, 0);
  },
  { keys: ['salesData', 'dateRange'] }
);

// Average order value
const averageOrderValue = computedStore(
  dashboard,
  state => {
    const filtered = state.salesData.filter(d =>
      d.date >= state.dateRange.start && d.date <= state.dateRange.end
    );
    const revenue = filtered.reduce((sum, d) => sum + d.revenue, 0);
    const orders = filtered.reduce((sum, d) => sum + d.orders, 0);
    return orders > 0 ? revenue / orders : 0;
  },
  { keys: ['salesData', 'dateRange'] }
);

// Top performing days
const topDays = computedStore(
  dashboard,
  state => {
    const filtered = state.salesData.filter(d =>
      d.date >= state.dateRange.start && d.date <= state.dateRange.end
    );
    return [...filtered]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  },
  {
    keys: ['salesData', 'dateRange'],
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  }
);

// Chart data (formatted for display)
const chartData = computedStore(
  dashboard,
  state => {
    const filtered = state.salesData.filter(d =>
      d.date >= state.dateRange.start && d.date <= state.dateRange.end
    );
    return filtered.map(d => ({
      x: new Date(d.date).getTime(),
      y: d.revenue,
      label: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: state.currency
      }).format(d.revenue)
    }));
  },
  { keys: ['salesData', 'dateRange', 'currency'] }
);

// In Svelte component - all efficiently reactive!
$: revenue = $totalRevenue;
$: avgOrder = $averageOrderValue;
$: best = $topDays;
$: data = $chartData;

// Changing theme doesn't recompute ANY metrics! 🎉
dashboard.update(s => { s.theme = 'dark'; });
```

#### Pattern 4: Search with Debounced Results

Combine computedStore with reactive queries.

```typescript
import { createReactor, computedStore } from 'svelte-reactor';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  tags: string[];
  inStock: boolean;
}

const store = createReactor({
  products: [] as Product[],
  query: '',
  category: 'all',
  priceRange: { min: 0, max: Infinity },
  showOutOfStock: false
});

// Computed search results
// Only recomputes when query, category, priceRange, or showOutOfStock change
const searchResults = computedStore(
  store,
  state => {
    let results = state.products;

    // Filter by stock
    if (!state.showOutOfStock) {
      results = results.filter(p => p.inStock);
    }

    // Filter by category
    if (state.category !== 'all') {
      results = results.filter(p => p.category === state.category);
    }

    // Filter by price range
    results = results.filter(p =>
      p.price >= state.priceRange.min && p.price <= state.priceRange.max
    );

    // Filter by search query
    if (state.query) {
      const q = state.query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return results;
  },
  {
    keys: ['products', 'query', 'category', 'priceRange', 'showOutOfStock']
  }
);

// Computed result counts by category
const categoryCounts = computedStore(
  store,
  state => {
    const counts: Record<string, number> = {};
    state.products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  },
  { keys: ['products'] }
);

// In Svelte component
$: results = $searchResults;
$: counts = $categoryCounts;
```

#### Pattern 5: Nested Computed Stores

Chain computed stores for complex pipelines.

```typescript
import { createReactor, computedStore } from 'svelte-reactor';

const store = createReactor({
  rawData: [] as { date: string; value: number }[],
  smoothingWindow: 7,
  threshold: 100
});

// Step 1: Smooth the data
const smoothedData = computedStore(
  store,
  state => {
    const window = state.smoothingWindow;
    return state.rawData.map((point, i) => {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(state.rawData.length, i + Math.ceil(window / 2));
      const slice = state.rawData.slice(start, end);
      const avg = slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
      return { ...point, value: avg };
    });
  },
  { keys: ['rawData', 'smoothingWindow'] }
);

// Step 2: Detect anomalies (computed from smoothed data)
const anomalies = computedStore(
  store,
  state => {
    // Get smoothed data
    const smoothed = state.rawData.map((point, i) => {
      const window = state.smoothingWindow;
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(state.rawData.length, i + Math.ceil(window / 2));
      const slice = state.rawData.slice(start, end);
      const avg = slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
      return avg;
    });

    // Find anomalies
    return state.rawData
      .map((point, i) => ({
        ...point,
        isAnomaly: Math.abs(point.value - smoothed[i]) > state.threshold
      }))
      .filter(p => p.isAnomaly);
  },
  { keys: ['rawData', 'smoothingWindow', 'threshold'] }
);

// Both computed stores update efficiently!
$: smooth = $smoothedData;
$: alerts = $anomalies;
```

**Performance tips:**
- 🎯 Specify `keys` to track only relevant dependencies
- ⚡ Use `equals: isEqual` for deep comparison of complex objects
- 📊 Chain computed stores for multi-step pipelines
- 🔄 Combine with `derived()` for multi-source computations
- 🚀 Performance gain: 2-10x faster for expensive operations

---

### Custom Middleware

Create custom middleware for logging, analytics, or side effects.

```typescript
import { createReactor } from 'svelte-reactor';

// Analytics middleware
const analyticsMiddleware = {
  name: 'analytics',
  onAfterUpdate(prevState: any, nextState: any, action?: string) {
    if (action) {
      // Track analytics event
      console.log('Analytics:', action, { prevState, nextState });
    }
  },
};

// API sync middleware
const apiSyncMiddleware = {
  name: 'api-sync',
  onAfterUpdate(prevState: any, nextState: any, action?: string) {
    if (action?.startsWith('save-')) {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextState),
      });
    }
  },
};

const reactor = createReactor(
  { value: 0 },
  {
    plugins: [
      {
        install: () => ({
          middlewares: [analyticsMiddleware, apiSyncMiddleware],
        }),
      },
    ],
  }
);
```

---

### Derived State

Use Svelte's `$derived` for computed values.

```typescript
import { createReactor } from 'svelte-reactor';

const cart = createReactor({
  items: [
    { id: '1', price: 10, quantity: 2 },
    { id: '2', price: 20, quantity: 1 },
  ],
  taxRate: 0.1,
});

// Computed values
const subtotal = $derived(
  cart.state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

const tax = $derived(subtotal * cart.state.taxRate);

const total = $derived(subtotal + tax);

// Use in template
console.log(`Total: $${total.toFixed(2)}`);
```

---

### Action Tracking

Use action names to track and debug state changes.

```typescript
import { createReactor } from 'svelte-reactor';
import { undoRedo, logger } from 'svelte-reactor/plugins';

const reactor = createReactor(
  { value: 0 },
  {
    plugins: [
      undoRedo({
        exclude: ['preview', 'hover'], // Don't track temporary actions
      }),
      logger(), // Logs all actions
    ],
  }
);

// Named actions for better debugging
reactor.update(s => { s.value++; }, 'increment');
reactor.update(s => { s.value = 100; }, 'preview'); // Won't be in history
reactor.update(s => { s.value = 0; }, 'reset');

// View history with action names
const history = reactor.getHistory();
console.log(history); // Each entry has action name
```

---

### State Migrations

Handle schema changes with version migrations.

```typescript
import { createReactor } from 'svelte-reactor';
import { persist } from 'svelte-reactor/plugins';

const todos = createReactor(
  {
    items: [] as Array<{ id: string; text: string; done: boolean; priority: 'low' | 'medium' | 'high' }>,
  },
  {
    plugins: [
      persist({
        key: 'todos',
        version: 3,
        migrate: (stored: any, version: number) => {
          // Migrate from v1 to v2: add 'done' field
          if (version < 2) {
            stored.items = stored.items.map((item: any) => ({
              ...item,
              done: false,
            }));
          }

          // Migrate from v2 to v3: add 'priority' field
          if (version < 3) {
            stored.items = stored.items.map((item: any) => ({
              ...item,
              priority: 'medium',
            }));
          }

          return stored;
        },
      }),
    ],
  }
);
```

---

## Best Practices

1. **Use action names** - Name your actions for better debugging and history tracking
2. **Batch operations** - Use `batch()` for multiple related updates
3. **Derive computed values** - Use `$derived` instead of storing computed state
4. **Exclude temporary actions** - Don't add preview/hover states to history
5. **Persist strategically** - Use debounce to avoid excessive writes
6. **Limit history** - Set reasonable `limit` in `undoRedo` to avoid memory issues
7. **Type your state** - Always use TypeScript interfaces for state shape
8. **Handle migrations** - Plan for schema changes with version migrations

---

## More Resources

- [README.md](./README.md) - Getting started and overview
- [API.md](./API.md) - Complete API reference
- [PERFORMANCE.md](./PERFORMANCE.md) - Performance benchmarks
