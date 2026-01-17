# Upgrade Guide: v0.3.2

**Target Release:** Q2 2026
**Codename:** "IndexedDB Performance & Collections"
**Status:** Planning

---

## Overview

v0.3.2 focuses on IndexedDB performance improvements and better collection support:

1. **IndexedDB Performance** - Connection pooling, batch writes, faster operations
2. **Collection Support** - Better API for storing arrays/collections in IndexedDB
3. **Test Optimization** - Faster test suite execution
4. **Demo Updates** - Update examples to use new `createForm()` API

---

## What's New

### 1. IndexedDB Connection Pooling

**Problem:** Each reactor opens a new IndexedDB connection, which is slow.

**Solution:** Shared connection pool per database.

```typescript
// Before: Each reactor opens new connection
const store1 = createReactor(state1, { plugins: [persist({ storage: 'indexedDB' })] });
const store2 = createReactor(state2, { plugins: [persist({ storage: 'indexedDB' })] });
// = 2 database connections

// After: Connections are pooled
const store1 = createReactor(state1, { plugins: [persist({ storage: 'indexedDB' })] });
const store2 = createReactor(state2, { plugins: [persist({ storage: 'indexedDB' })] });
// = 1 shared connection
```

**API:** No changes needed - automatic optimization.

### 2. Batch Writes

**Problem:** Multiple rapid updates = multiple IndexedDB transactions.

**Solution:** Automatic batching of writes within a time window.

```typescript
// Before: 10 updates = 10 transactions
for (let i = 0; i < 10; i++) {
  store.update(s => { s.count = i; });
}

// After: 10 updates = 1 batched transaction
// Automatic batching with configurable window
persist({
  storage: 'indexedDB',
  batchWrites: true,      // NEW: Enable batching (default: true)
  batchWindow: 50         // NEW: Batch window in ms (default: 50)
})
```

### 3. Collection Support

**Problem:** Storing large arrays is inefficient - entire array rewritten on each change.

**Solution:** New collection-aware persistence mode.

```typescript
// Before: Entire todos array saved on every change
const todos = createReactor({ items: [] }, {
  plugins: [persist({ key: 'todos', storage: 'indexedDB' })]
});

// After: Individual items stored separately
const todos = createReactor({ items: [] }, {
  plugins: [
    persist({
      key: 'todos',
      storage: 'indexedDB',
      collections: {
        items: {
          idKey: 'id',           // Field to use as key
          saveIndividually: true // Store each item separately
        }
      }
    })
  ]
});

// Benefits:
// - Only changed items are written
// - Faster reads (can load subset)
// - Better for large datasets (1000+ items)
```

**Collection Options:**

```typescript
interface CollectionConfig {
  idKey: string;              // Primary key field (default: 'id')
  saveIndividually?: boolean; // Store items separately (default: false)
  indexFields?: string[];     // Fields to index for querying
  maxItems?: number;          // Max items to keep (LRU eviction)
}
```

### 4. Query Support (Preview)

**New:** Basic querying for collections.

```typescript
const todos = createReactor({ items: [] }, {
  plugins: [
    persist({
      key: 'todos',
      storage: 'indexedDB',
      collections: {
        items: {
          idKey: 'id',
          indexFields: ['status', 'createdAt']
        }
      }
    })
  ]
});

// Query items (async)
const completed = await todos.query('items', {
  where: { status: 'completed' },
  orderBy: 'createdAt',
  limit: 10
});
```

---

## Performance Improvements

### Test Suite Optimization

**Current:** IndexedDB tests take ~15-20 seconds

**Target:** < 5 seconds

| Optimization | Impact |
|--------------|--------|
| Reduce simulatePageReload wait: 300ms → 50ms | -10s |
| Use vitest fake timers | -3s |
| Parallel test execution | -2s |

### Runtime Performance

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Open database | ~50ms | ~5ms (pooled) | 10x |
| Write 100 items | ~500ms | ~50ms (batched) | 10x |
| Update 1 item in 1000 | ~100ms | ~5ms (individual) | 20x |
| Load 1000 items | ~200ms | ~200ms | Same |

---

## Implementation Plan

### Phase 1: Connection Pooling
- [ ] Create `IndexedDBPool` class
- [ ] Singleton pool per database name
- [ ] Reference counting for cleanup
- [ ] Tests for concurrent access
- [ ] Benchmark: verify 10x improvement

### Phase 2: Batch Writes
- [ ] Add `batchWrites` option to persist plugin
- [ ] Implement write queue with configurable window
- [ ] Flush on destroy/beforeunload
- [ ] Tests for batch behavior
- [ ] Benchmark: verify 10x improvement

### Phase 3: Collection Support
- [ ] Design collection storage schema
- [ ] Implement `collections` option
- [ ] Add `saveIndividually` mode
- [ ] Implement delta updates (only changed items)
- [ ] Tests for collection CRUD
- [ ] Tests for large datasets (10,000+ items)

### Phase 4: Query Support (Preview)
- [ ] Add `query()` method to reactor
- [ ] Implement basic where/orderBy/limit
- [ ] Index creation for indexed fields
- [ ] Tests for query operations
- [ ] Documentation

### Phase 5: Test Optimization
- [ ] Reduce wait times in IndexedDB tests
- [ ] Add vitest fake timer support
- [ ] Verify all 596+ tests still pass
- [ ] Target: < 5s for IndexedDB tests

### Phase 6: Form Examples (Deferred from v0.3.0)

Interactive form examples in `examples/reactor-demos/`:

- [ ] **Basic Login Form**
  - Email/password with validation
  - useField action usage
  - Error display
  - Submit handling

- [ ] **Registration with Password Confirmation**
  - Cross-field validation
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

### Phase 7: Demo Updates
- [ ] Update ContactForm.svelte to use `createForm()`
- [ ] Update demo site to use `@svelte-reactor/core` imports
- [ ] Update demo README

---

## Migration Guide

### No Breaking Changes

v0.3.1 is fully backward compatible. All improvements are opt-in or automatic.

### Enabling New Features

```typescript
// Connection pooling: automatic, no changes needed

// Batch writes: enabled by default in v0.3.1
persist({
  storage: 'indexedDB',
  batchWrites: true  // default
})

// Collection support: opt-in
persist({
  storage: 'indexedDB',
  collections: {
    items: { idKey: 'id', saveIndividually: true }
  }
})
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| IndexedDB test time | < 5s (from 15s) |
| Connection open time | < 10ms (from 50ms) |
| Batch write performance | 10x improvement |
| Collection update performance | 20x improvement |
| Bundle size increase | < 1 KB |
| New tests | 30+ |

---

## Checklist

### Phase 1: Connection Pooling
- [ ] `IndexedDBPool` class
- [ ] Reference counting
- [ ] Concurrent access tests
- [ ] Performance benchmark

### Phase 2: Batch Writes
- [ ] `batchWrites` option
- [ ] Write queue
- [ ] Flush handling
- [ ] Tests

### Phase 3: Collections
- [ ] `collections` option
- [ ] Individual item storage
- [ ] Delta updates
- [ ] Large dataset tests

### Phase 4: Query (Preview)
- [ ] `query()` method
- [ ] Basic operators
- [ ] Index support
- [ ] Documentation

### Phase 5: Tests
- [ ] Optimize wait times
- [ ] Fake timers
- [ ] All tests pass

### Phase 6: Form Examples
- [ ] Basic login form
- [ ] Registration form
- [ ] Multi-step wizard
- [ ] Dynamic fields

### Phase 7: Demos
- [ ] Update existing demos
- [ ] Update imports to @svelte-reactor/core

---

**Created:** 2025-01-10
**Updated:** 2025-01-16
**Status:** Planning
