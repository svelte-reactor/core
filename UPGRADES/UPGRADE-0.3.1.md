# Upgrade Guide: v0.3.1

**Release Date:** 2026-01-17
**Codename:** "Bundle Optimization"
**Status:** Released

---

## Overview

v0.3.1 fixes a critical bundle size issue where Svelte runtime was being duplicated.

1. **Bundle Size Fix** - Stop bundling Svelte runtime (~59% reduction in computed-store chunk)
2. **Documentation** - All docs updated with v0.3.1 version

---

## What's Fixed

### Bundle Size Optimization (CRITICAL)

**Problem:** `@svelte-reactor/core@0.3.0` bundled Svelte 5 internals instead of using them as external dependency.

**Before (v0.3.0):**
```
node_modules/@svelte-reactor/core/dist/
├── computed-store-*.js   38 KB (11.5 KB gzip) ← Bundled Svelte internals!
├── persist-plugin-*.js   16 KB (5 KB gzip)
├── lz-string-*.js         9 KB (lazy)
└── index.js               2.5 KB
```

**After (v0.3.1):**
```
node_modules/@svelte-reactor/core/dist/
├── computed-store-*.js   15.71 KB (4.59 KB gzip) ← 59% smaller!
├── persist-plugin-*.js   15.99 KB (4.20 KB gzip)
├── lz-string-*.js         9.04 KB (lazy)
└── index.js               2.52 KB
```

**What was fixed in `vite.config.ts`:**

```typescript
rollupOptions: {
  external: [
    'svelte',
    'svelte/store',
    'svelte/reactivity',
    'svelte/internal',           // NEW
    'svelte/internal/client',    // NEW
    'svelte/internal/server',    // NEW
    /^svelte\//,                 // NEW - catch all svelte/* imports
  ],
}
```

---

## Migration Guide

### No Breaking Changes

v0.3.1 is fully backward compatible. Just update your package:

```bash
npm update @svelte-reactor/core
# or
pnpm update @svelte-reactor/core
```

### Expected Impact on Consumer Apps

Your app bundle will no longer include duplicated Svelte runtime code. The savings depend on how your bundler handles shared dependencies.

---

## Changelog

- **Fixed:** Svelte runtime duplication in build output
- **Changed:** `computed-store` chunk: 38 KB → 15.71 KB (59% smaller)
- **Added:** Missing Svelte externals in vite.config.ts
- **Tests:** 617 tests passing

---

**Released:** 2026-01-17
