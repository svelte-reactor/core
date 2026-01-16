# Form Helper Guide

Complete guide to `createForm()` - reactive form management for Svelte 5.

**NEW in v0.3.0** - A killer feature for svelte-reactor.

## Why createForm()?

- Every project needs forms
- No good Svelte 5 runes-based solution exists
- React has Formik, React Hook Form - Svelte 5 has nothing comparable
- Built on Svelte 5 runes for maximum performance

## Quick Start

```typescript
import { createForm } from '@svelte-reactor/core/helpers';

const form = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: (v) => v.includes('@') || 'Invalid email',
    password: (v) => v.length >= 8 || 'Min 8 characters'
  },
  onSubmit: async (values) => {
    await api.login(values);
  }
});
```

## Installation

```bash
npm install @svelte-reactor/core
```

## API Reference

### createForm(options)

```typescript
import { createForm } from '@svelte-reactor/core/helpers';

const form = createForm<T>(options: FormOptions<T>): Form<T>
```

### FormOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialValues` | `T` | required | Initial form values object |
| `validate` | `ValidationSchema<T>` | `{}` | Sync validation rules per field |
| `validateAsync` | `AsyncValidationSchema<T>` | `{}` | Async validation rules |
| `onSubmit` | `(values: T) => void \| Promise<void>` | - | Submit handler |
| `validateOn` | `'change' \| 'blur' \| 'submit'` | `'change'` | When to trigger validation |
| `persistDraft` | `string` | - | localStorage key for draft persistence |
| `persistDebounce` | `number` | `500` | Debounce for draft persistence (ms) |
| `persistTransform` | `(values: T) => Partial<T>` | - | Transform before persisting |

### Form State (Reactive)

All state properties are reactive and can be used directly in Svelte templates.

| Property | Type | Description |
|----------|------|-------------|
| `values` | `T` | Current form values |
| `initialValues` | `T` | Initial values (for reset comparison) |
| `touched` | `Record<keyof T, boolean>` | Fields that have been blurred |
| `dirty` | `Record<keyof T, boolean>` | Fields modified from initial |
| `errors` | `Record<keyof T, string>` | Validation error messages |
| `isValid` | `boolean` | True if no errors exist |
| `isDirty` | `boolean` | True if any field is modified |
| `isSubmitting` | `boolean` | True during form submission |
| `submitCount` | `number` | Number of submit attempts |
| `submitError` | `string \| null` | Error from last failed submit |

### Form Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setField` | `(field, value) => void` | Set a single field value |
| `setFields` | `(values) => void` | Set multiple field values |
| `setError` | `(field, error) => void` | Set a field error manually |
| `clearError` | `(field) => void` | Clear a field error |
| `setTouched` | `(field) => void` | Mark a field as touched |
| `validate` | `() => Promise<boolean>` | Validate entire form |
| `validateField` | `(field) => Promise<boolean>` | Validate single field |
| `submit` | `() => Promise<void>` | Validate and call onSubmit |
| `reset` | `(values?) => void` | Reset form to initial values |
| `field` | `(name) => FieldProps` | Get field props for binding |
| `useField` | `(node, name) => { destroy }` | Svelte action for form binding |
| `destroy` | `() => void` | Cleanup (timers, etc.) |

---

## Validation

### Sync Validation

Validation functions return `true` for valid, or an error message string for invalid.

```typescript
const form = createForm({
  initialValues: { email: '', age: 0 },
  validate: {
    // Single rule
    email: (value) => value.includes('@') || 'Invalid email',

    // Multiple rules (array)
    age: [
      (v) => v > 0 || 'Age is required',
      (v) => v >= 18 || 'Must be 18 or older',
      (v) => v <= 120 || 'Invalid age'
    ]
  }
});
```

### Cross-Field Validation

Validation functions receive all form values as the second argument:

```typescript
const form = createForm({
  initialValues: { password: '', confirmPassword: '' },
  validate: {
    confirmPassword: (value, values) =>
      value === values.password || 'Passwords must match'
  }
});
```

### Async Validation

Async validation runs after sync validation passes:

```typescript
const form = createForm({
  initialValues: { username: '', email: '' },

  // Sync validation runs first
  validate: {
    username: (v) => v.length >= 3 || 'Min 3 characters',
    email: (v) => v.includes('@') || 'Invalid email'
  },

  // Async validation runs after sync passes
  validateAsync: {
    username: async (value) => {
      const available = await api.checkUsername(value);
      return available || 'Username already taken';
    },
    email: async (value) => {
      const exists = await api.checkEmail(value);
      return !exists || 'Email already registered';
    }
  }
});
```

### Validation Timing

Control when validation runs with `validateOn`:

```typescript
// Validate on every keystroke (default)
createForm({ validateOn: 'change', ... });

// Validate when field loses focus
createForm({ validateOn: 'blur', ... });

// Only validate on form submit
createForm({ validateOn: 'submit', ... });
```

---

## Svelte Component Examples

### Basic Login Form

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';
  import { onDestroy } from 'svelte';

  const form = createForm({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false
    },
    validate: {
      email: [
        (v) => !!v || 'Email is required',
        (v) => v.includes('@') || 'Invalid email format'
      ],
      password: [
        (v) => !!v || 'Password is required',
        (v) => v.length >= 8 || 'Password must be at least 8 characters'
      ]
    },
    onSubmit: async (values) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!response.ok) throw new Error('Login failed');
    },
    validateOn: 'blur',
    persistDraft: 'login-form'
  });

  onDestroy(() => form.destroy());
</script>

<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <div class="field">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={form.values.email}
      onblur={() => form.setTouched('email')}
      class:error={form.touched.email && form.errors.email}
    />
    {#if form.touched.email && form.errors.email}
      <span class="error-message">{form.errors.email}</span>
    {/if}
  </div>

  <div class="field">
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={form.values.password}
      onblur={() => form.setTouched('password')}
      class:error={form.touched.password && form.errors.password}
    />
    {#if form.touched.password && form.errors.password}
      <span class="error-message">{form.errors.password}</span>
    {/if}
  </div>

  <div class="field">
    <label>
      <input type="checkbox" bind:checked={form.values.rememberMe} />
      Remember me
    </label>
  </div>

  <button type="submit" disabled={!form.isValid || form.isSubmitting}>
    {form.isSubmitting ? 'Logging in...' : 'Login'}
  </button>

  {#if form.submitError}
    <div class="submit-error">{form.submitError}</div>
  {/if}
</form>

<style>
  .field { margin-bottom: 1rem; }
  .error { border-color: red; }
  .error-message { color: red; font-size: 0.875rem; }
  .submit-error { color: red; margin-top: 1rem; }
</style>
```

### Using field() Helper

The `field()` method provides props for automatic binding:

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';

  const form = createForm({
    initialValues: { name: '', email: '' },
    validate: {
      name: (v) => !!v || 'Name is required',
      email: (v) => v.includes('@') || 'Invalid email'
    },
    onSubmit: async (values) => console.log(values)
  });
</script>

<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <!-- Automatic binding with field() -->
  <input type="text" {...form.field('name')} placeholder="Name" />
  <input type="email" {...form.field('email')} placeholder="Email" />

  <button type="submit">Submit</button>
</form>
```

### Using useField Svelte Action (NEW)

The `useField` action provides even cleaner form binding using Svelte's `use:` directive:

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';

  const form = createForm({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
      country: 'us',
      message: ''
    },
    validate: {
      email: (v) => v.includes('@') || 'Invalid email',
      password: (v) => v.length >= 8 || 'Min 8 characters'
    },
    onSubmit: async (values) => console.log(values)
  });
</script>

<form onsubmit={(e) => { e.preventDefault(); form.submit(); }}>
  <!-- Text input -->
  <input type="email" use:form.useField={'email'} placeholder="Email" />

  <!-- Password input -->
  <input type="password" use:form.useField={'password'} placeholder="Password" />

  <!-- Checkbox -->
  <label>
    <input type="checkbox" use:form.useField={'rememberMe'} />
    Remember me
  </label>

  <!-- Select -->
  <select use:form.useField={'country'}>
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
    <option value="ua">Ukraine</option>
  </select>

  <!-- Textarea -->
  <textarea use:form.useField={'message'} placeholder="Your message"></textarea>

  <button type="submit">Submit</button>
</form>
```

#### useField vs field()

| Feature | `field()` | `useField` |
|---------|-----------|------------|
| Syntax | `{...form.field('name')}` | `use:form.useField={'name'}` |
| Works with | All HTML elements | `<input>`, `<select>`, `<textarea>` |
| Checkbox support | Manual handling | Automatic |
| Value sync | One-way (props) | Two-way (action) |
| Best for | Custom components | Native form elements |

**Recommendation:** Use `useField` for native form elements (cleaner syntax). Use `field()` when spreading props to custom components.

### Registration Form with Async Validation

```svelte
<script lang="ts">
  import { createForm } from '@svelte-reactor/core/helpers';

  const form = createForm({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validate: {
      username: [
        (v) => v.length >= 3 || 'Min 3 characters',
        (v) => /^[a-z0-9_]+$/.test(v) || 'Only lowercase letters, numbers, underscores'
      ],
      email: (v) => v.includes('@') || 'Invalid email',
      password: [
        (v) => v.length >= 8 || 'Min 8 characters',
        (v) => /[A-Z]/.test(v) || 'Must contain uppercase letter',
        (v) => /[0-9]/.test(v) || 'Must contain number'
      ],
      confirmPassword: (v, values) =>
        v === values.password || 'Passwords must match'
    },
    validateAsync: {
      username: async (value) => {
        const res = await fetch(`/api/check-username?u=${value}`);
        const { available } = await res.json();
        return available || 'Username already taken';
      },
      email: async (value) => {
        const res = await fetch(`/api/check-email?e=${value}`);
        const { available } = await res.json();
        return available || 'Email already registered';
      }
    },
    onSubmit: async (values) => {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
    },
    validateOn: 'blur'
  });
</script>
```

---

## Draft Persistence

Save form progress to localStorage automatically:

```typescript
const form = createForm({
  initialValues: { email: '', message: '' },

  // Key for localStorage
  persistDraft: 'contact-form',

  // Debounce saves (default: 500ms)
  persistDebounce: 500,

  // Only persist certain fields (exclude sensitive data)
  persistTransform: (values) => ({
    email: values.email,
    message: values.message
    // password field would NOT be persisted
  }),

  onSubmit: async (values) => {
    await sendMessage(values);
    // Draft automatically cleared on successful submit
  }
});
```

### How Draft Persistence Works

1. **On Load**: Draft is loaded from localStorage when form is created
2. **On Change**: Values are saved to localStorage (debounced)
3. **On Submit Success**: Draft is automatically cleared
4. **On Reset**: Draft is automatically cleared

### Storage Key Format

Drafts are stored with the prefix `svelte-reactor-form:`:

```typescript
// persistDraft: 'contact-form'
// Stored as: localStorage['svelte-reactor-form:contact-form']
```

---

## Best Practices

### 1. Always Clean Up

```svelte
<script>
  import { onDestroy } from 'svelte';

  const form = createForm({ ... });

  onDestroy(() => form.destroy());
</script>
```

### 2. Show Errors Only After Touch

```svelte
<!-- Don't show errors for fields the user hasn't interacted with -->
{#if form.touched.email && form.errors.email}
  <span class="error">{form.errors.email}</span>
{/if}
```

### 3. Disable Submit When Invalid or Submitting

```svelte
<button disabled={!form.isValid || form.isSubmitting}>
  Submit
</button>
```

### 4. Handle Submit Errors

```svelte
{#if form.submitError}
  <div class="error">{form.submitError}</div>
{/if}
```

### 5. Use persistTransform for Sensitive Data

```typescript
createForm({
  persistDraft: 'checkout-form',
  persistTransform: (values) => ({
    // Persist address, name
    address: values.address,
    name: values.name
    // Do NOT persist credit card
  })
});
```

---

## TypeScript Support

Full TypeScript inference for form values:

```typescript
interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

const form = createForm<LoginForm>({
  initialValues: {
    email: '',
    password: '',
    rememberMe: false
  },
  validate: {
    email: (v) => v.includes('@') || 'Invalid', // v is inferred as string
    rememberMe: (v) => true // v is inferred as boolean
  }
});

// form.values is typed as LoginForm
// form.errors is typed as Record<keyof LoginForm, string>
// form.setField('email', 123) // TypeScript error!
```

---

## Performance

The form helper is optimized for performance:

| Metric | Result |
|--------|--------|
| 1000 rapid field updates | < 100ms |
| 100 fields with validation | < 50ms |
| Concurrent async validations | Handled correctly |
| Memory leaks | None (tested with create/destroy cycles) |

---

## Migration from Manual Forms

### Before (manual state management)

```typescript
const formStore = createReactor({
  values: { email: '', password: '' },
  errors: {} as Record<string, string>,
  touched: {} as Record<string, boolean>,
  isSubmitting: false
});

function setField(field: string, value: string) {
  formStore.update(s => {
    s.values[field] = value;
    s.touched[field] = true;
    // Manual validation...
  });
}

function validate() {
  formStore.update(s => {
    s.errors = {};
    if (!s.values.email) s.errors.email = 'Required';
    // More validation...
  });
}

async function submit() {
  if (!validate()) return;
  formStore.update(s => { s.isSubmitting = true; });
  try {
    await api.login(formStore.state.values);
  } finally {
    formStore.update(s => { s.isSubmitting = false; });
  }
}
```

### After (using createForm)

```typescript
const form = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: (v) => !!v || 'Required',
    password: (v) => v.length >= 8 || 'Min 8 characters'
  },
  onSubmit: async (values) => await api.login(values)
});

// That's it! All state management is handled automatically.
```

---

## See Also

- [API Reference](./API.md#createform) - Complete API documentation
- [Quick Start](./QUICK_START.md#form-management-new-in-v030) - Getting started
- [Upgrade Guide](../../UPGRADES/UPGRADE-0.3.0.md) - v0.3.0 migration

---

**Created:** v0.3.0
**Tests:** 94 tests including stress tests
