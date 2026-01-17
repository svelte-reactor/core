# Upgrade Guide: v0.3.2

**Target Release:** Q1 2026
**Codename:** "Bundle Slimming"
**Status:** Planning

---

## Overview

v0.3.2 focuses on reducing bundle size by extracting forms into a separate package:

1. **Package Split** - Extract `createForm` to `@svelte-reactor/forms`
2. **Bundle Optimization** - Reduce core to ~10-12 KB gzip
3. **Form Examples** - Interactive form demos
4. **Demo Updates** - Update examples to new package structure

---

## Why Split Forms?

**Current state (v0.3.1):**
```
@svelte-reactor/core: ~16 KB gzip (everything included)
```

**Problem:**
- Many users don't need forms
- Forms add ~3-4 KB to bundle
- Core functionality gets diluted

**After v0.3.2:**
```
@svelte-reactor/core:  ~10-12 KB gzip (state management)
@svelte-reactor/forms: ~4-5 KB gzip (forms, optional)
```

---

## What's New

### 1. New Package: `@svelte-reactor/forms`

```typescript
// Before (v0.3.1)
import { createForm } from '@svelte-reactor/core/helpers';

// After (v0.3.2) - NEW PACKAGE
import { createForm } from '@svelte-reactor/forms';

// Old import still works (re-export with deprecation warning)
import { createForm } from '@svelte-reactor/core/helpers'; // Shows warning
```

**Package structure:**
```
@svelte-reactor/forms
├── createForm()        - Main form helper
├── useField            - Svelte action for inputs
├── validators          - Common validators (email, minLength, etc.)
└── types               - TypeScript definitions
```

### 2. Built-in Validators (NEW)

```typescript
import { createForm, validators } from '@svelte-reactor/forms';

const form = createForm({
  initialValues: { email: '', password: '', age: '' },
  validate: {
    email: [validators.required(), validators.email()],
    password: [validators.required(), validators.minLength(8)],
    age: [validators.required(), validators.number(), validators.min(18)]
  }
});
```

**Available validators:**
| Validator | Description |
|-----------|-------------|
| `required(msg?)` | Field must not be empty |
| `email(msg?)` | Valid email format |
| `minLength(n, msg?)` | Minimum string length |
| `maxLength(n, msg?)` | Maximum string length |
| `min(n, msg?)` | Minimum number value |
| `max(n, msg?)` | Maximum number value |
| `pattern(regex, msg?)` | Match regex pattern |
| `number(msg?)` | Must be a valid number |
| `url(msg?)` | Valid URL format |
| `match(field, msg?)` | Must match another field |

### 3. Bundle Size Reduction

| Package | v0.3.1 | v0.3.2 | Change |
|---------|--------|--------|--------|
| `@svelte-reactor/core` | ~16 KB | ~10-12 KB | **-25%** |
| `@svelte-reactor/forms` | - | ~4-5 KB | New |
| **Total (both)** | ~16 KB | ~15-17 KB | Same |
| **Core only** | ~16 KB | ~10-12 KB | **-25%** |

---

## Implementation Plan

### Phase 1: Package Setup
- [ ] Create `packages/forms/` directory
- [ ] Setup package.json for `@svelte-reactor/forms`
- [ ] Move form.svelte.ts to new package
- [ ] Setup build configuration

### Phase 2: Validators
- [ ] Create `validators/` module
- [ ] Implement common validators
- [ ] Add custom validator support
- [ ] Tests for all validators

### Phase 3: Migration Support
- [ ] Re-export from `@svelte-reactor/core/helpers` with deprecation warning
- [ ] Update documentation
- [ ] Migration guide

### Phase 4: Form Examples

Interactive form examples in `examples/reactor-demos/`:

- [ ] **Basic Login Form**
  - Email/password with validation
  - useField action usage
  - Error display
  - Submit handling

- [ ] **Registration with Password Confirmation**
  - Cross-field validation (password match)
  - Password strength indicator
  - Async email availability check
  - Terms checkbox

- [ ] **Multi-step Form Wizard**
  - 3+ steps with navigation
  - Per-step validation
  - Progress indicator
  - Data persistence between steps

- [ ] **Dynamic Form Fields**
  - Add/remove fields dynamically
  - Array field validation
  - Reordering support

### Phase 5: Demo Updates
- [ ] Update ContactForm.svelte to use `@svelte-reactor/forms`
- [ ] Update demo site imports
- [ ] Update demo README

---

## Migration Guide

### Automatic (Recommended)

Old imports continue to work with deprecation warning:

```typescript
// This still works in v0.3.2 (with console warning)
import { createForm } from '@svelte-reactor/core/helpers';
```

### Manual Migration

```bash
npm install @svelte-reactor/forms
```

```typescript
// Before
import { createForm } from '@svelte-reactor/core/helpers';

// After
import { createForm } from '@svelte-reactor/forms';
```

### Using New Validators

```typescript
// Before (custom validation functions)
const form = createForm({
  validate: {
    email: (v) => !!v || 'Required',
    password: (v) => v.length >= 8 || 'Min 8 chars'
  }
});

// After (built-in validators)
import { createForm, validators } from '@svelte-reactor/forms';

const form = createForm({
  validate: {
    email: validators.required(),
    password: validators.minLength(8)
  }
});

// Mix both approaches
const form = createForm({
  validate: {
    email: [validators.required(), validators.email()],
    custom: (v) => v.startsWith('A') || 'Must start with A'
  }
});
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Core bundle size | < 12 KB gzip (from 16 KB) |
| Forms package size | < 5 KB gzip |
| Migration effort | < 5 min |
| New validators | 10+ |
| Form examples | 4 |
| New tests | 50+ |

---

## Checklist

### Phase 1: Package Setup
- [ ] Create packages/forms/
- [ ] package.json
- [ ] vite.config.ts
- [ ] tsconfig.json

### Phase 2: Code Migration
- [ ] Move form.svelte.ts
- [ ] Create validators/
- [ ] Update exports
- [ ] Deprecation re-export

### Phase 3: Testing
- [ ] Move form tests
- [ ] Add validator tests
- [ ] Integration tests
- [ ] All tests pass

### Phase 4: Documentation
- [ ] README for @svelte-reactor/forms
- [ ] API documentation
- [ ] Migration guide
- [ ] Update main README

### Phase 5: Examples
- [ ] Login form
- [ ] Registration form
- [ ] Multi-step wizard
- [ ] Dynamic fields

---

**Created:** 2026-01-17
**Status:** Planning
