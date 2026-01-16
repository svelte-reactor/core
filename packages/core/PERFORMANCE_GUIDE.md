# Performance Optimization Guide

Complete guide to optimizing svelte-reactor performance for production applications.

---

## Table of Contents

- [Understanding Reactor Performance](#understanding-reactor-performance)
- [Optimization Strategies](#optimization-strategies)
- [Memory Management](#memory-management)
- [Performance Monitoring](#performance-monitoring)
- [Common Pitfalls](#common-pitfalls)
- [Benchmarking Your App](#benchmarking-your-app)

---

## Understanding Reactor Performance

### Performance Characteristics

svelte-reactor performance varies by use case:

| Use Case | Operations/sec | Duration | Details |
|----------|----------------|----------|---------|
| Small objects (<100 fields) | 50,000+ ops/sec | <0.02ms | Optimal performance |
| Medium objects (100-500 fields) | 10,000+ ops/sec | <0.1ms | Good performance |
| Large arrays (1000+ items) | 107 ops/sec | ~9.4ms | Deep clone overhead |
| Nested updates | 20,000+ ops/sec | <0.05ms | Efficient |
| With plugins (persist) | 5,000+ ops/sec | <0.2ms | Depends on plugin |

### Performance Bottlenecks

**1. Deep Cloning Large Objects**
```typescript
// Slow: Deep cloning 10,000 item array
store.update(s => {
  s.items.push(newItem); // ~9.4ms per update
});
```

**Why?** Each update creates a deep clone of the entire state for history tracking.

**2. Unnecessary Re-renders**
```typescript
// Inefficient: Entire component re-renders
$: console.log($store); // Subscribes to all changes

// Better: Subscribe to specific fields
$: console.log($store.count); // Only re-renders when count changes
```

**3. Excessive Persistence Writes**
```typescript
// Slow: Writes to localStorage on every update
persist({ key: 'data', debounce: 0 }); // No debouncing!

// Fast: Debounced writes
persist({ key: 'data', debounce: 500 }); // Max 2 writes/sec
```

### Bundle Size Impact

| Feature | Size (gzipped) | Tree-shakeable |
|---------|----------------|----------------|
| Core reactor | ~3 KB | ✅ Required |
| Undo/Redo | ~2 KB | ✅ Yes |
| Persist | ~3 KB | ✅ Yes |
| Logger | ~1 KB | ✅ Yes |
| Multi-tab sync | ~1 KB | ✅ Yes |
| Array actions | ~2 KB | ✅ Yes |
| Async actions | ~2 KB | ✅ Yes |
| DevTools | ~1.5 KB | ✅ Yes |
| **Total (all features)** | **~11.5 KB** | **Import only what you use** |

---

## Optimization Strategies

### 1. Use Batch Updates

Combine multiple updates into one to reduce overhead.

**❌ Bad: Multiple Individual Updates**
```typescript
// Each update triggers: clone → middleware → subscribers → history
items.forEach(item => {
  store.update(s => {
    s.items.push(item);
  });
}); // 1000 items = 1000 updates = slow!
```

**✅ Good: Single Batched Update**
```typescript
store.update(s => {
  s.items.push(...items); // Single update
}); // 1000 items = 1 update = fast!
```

**Performance Impact:** 100-1000x faster for bulk operations

---

### 2. Debounce Persistence

Reduce localStorage/IndexedDB writes for better performance.

**❌ Bad: No Debouncing**
```typescript
persist({
  key: 'data',
  debounce: 0 // Writes on EVERY update
});

// User types "hello" → 5 localStorage writes!
```

**✅ Good: Debounced Writes**
```typescript
persist({
  key: 'data',
  debounce: 500 // Max 2 writes/second
});

// User types "hello" → 1 localStorage write!
```

**Performance Impact:** 10-100x fewer I/O operations

**Recommended Debounce Times:**
- Form inputs: `500-1000ms`
- Real-time updates: `100-300ms`
- Infrequent changes: `0ms` (no debounce)

---

### 3. Selective Persistence (Pick/Omit)

Only persist what you need to reduce write size.

**❌ Bad: Persist Everything**
```typescript
const store = createReactor({
  user: { id: 1, name: 'Alice', token: 'secret123' },
  cache: { /* 10MB of cached data */ },
  temp: { /* temporary UI state */ }
}, {
  plugins: [persist({ key: 'app' })] // Persists ALL 10MB+
});
```

**✅ Good: Selective Persistence**
```typescript
persist({
  key: 'app',
  pick: ['user'], // Only persist user
  // OR
  omit: ['cache', 'temp', 'user.token'] // Exclude temporary data
});
```

**Performance Impact:**
- 90% smaller localStorage usage
- 10x faster save/load times
- No token leakage

---

### 4. Use Pagination for Large Arrays

Handle large datasets efficiently with built-in pagination.

**❌ Bad: Render All 10,000 Items**
```typescript
const store = createReactor({
  items: Array(10000).fill({})
});

// Component
{#each $store.items as item}
  <ItemCard {item} /> <!-- 10,000 DOM nodes! -->
{/each}
```

**✅ Good: Paginated Rendering**
```typescript
const actions = arrayActions(store, 'items', {
  pagination: { pageSize: 50 } // Only 50 items at a time
});

// Component
{#each actions.getCurrentPage() as item}
  <ItemCard {item} /> <!-- 50 DOM nodes -->
{/each}

<Pagination
  currentPage={actions.state.currentPage}
  totalPages={actions.state.totalPages}
  onPageChange={actions.goToPage}
/>
```

**Performance Impact:**
- 200x fewer DOM nodes
- Instant page loads
- Smooth scrolling

---

### 5. Optimize Array Updates

Use specialized array actions for large arrays.

**❌ Slow: Direct Array Manipulation**
```typescript
store.update(s => {
  s.items.push(newItem); // Deep clones entire array
}); // ~9.4ms for 10,000 items
```

**✅ Fast: Array Actions**
```typescript
const actions = arrayActions(store, 'items');
actions.add(newItem); // Optimized for arrays
// Same result, better performance
```

**Performance Impact:** 2-5x faster for large arrays

**Array Actions Performance:**
```typescript
// Benchmark results (10,000 items)
actions.add(item)        // ~2ms
actions.remove(id)       // ~2ms
actions.update(id, data) // ~2ms
actions.clear()          // <1ms
actions.filter(fn)       // ~3ms
```

---

### 6. Use Compression for Large State

Enable compression to reduce storage size.

**Without Compression:**
```typescript
persist({ key: 'data' });
// State: 500KB → localStorage: 500KB
```

**With Compression:**
```typescript
persist({
  key: 'data',
  compress: true // LZ compression
});
// State: 500KB → localStorage: 150KB (70% smaller!)
```

**Benefits:**
- 40-70% size reduction
- Faster save/load (less I/O)
- More data fits in 5MB localStorage limit
- Tree-shakeable (+0KB if not used)

**Trade-offs:**
- Small CPU overhead (~1ms for 100KB)
- Best for repetitive/text data

---

### 7. Memory Storage for Testing

Use memory storage for tests to avoid I/O overhead.

**❌ Slow Tests:**
```typescript
// Each test writes to localStorage
persist({ key: 'test-data', storage: 'localStorage' });
// 1000 tests × 10ms = 10 seconds of I/O
```

**✅ Fast Tests:**
```typescript
persist({ key: 'test-data', storage: 'memory' });
// 1000 tests × 0.1ms = 0.1 seconds!
```

**Performance Impact:** 100x faster tests

---

### 8. Debounce Multi-Tab Sync

Reduce broadcast frequency for better performance.

**❌ Bad: Sync Every Update**
```typescript
multiTabSync({
  key: 'app',
  debounce: 0 // Broadcasts every update
});
// User types "hello" → 5 broadcasts
```

**✅ Good: Debounced Sync**
```typescript
multiTabSync({
  key: 'app',
  debounce: 100 // Max 10 syncs/second
});
// User types "hello" → 1 broadcast
```

**Recommended Settings:**
- Real-time collaboration: `50-100ms`
- General sync: `200-500ms`
- Infrequent updates: `0ms`

---

## Memory Management

### 1. Cleanup Subscriptions

Always unsubscribe to prevent memory leaks.

**❌ Memory Leak:**
```typescript
// Svelte component
store.subscribe(state => {
  console.log(state); // Never cleaned up!
});
```

**✅ Proper Cleanup:**
```typescript
import { onDestroy } from 'svelte';

const unsubscribe = store.subscribe(state => {
  console.log(state);
});

onDestroy(unsubscribe); // Cleanup on component destroy
```

**Or Use Auto-Subscription:**
```typescript
// Svelte auto-unsubscribes $store
$: console.log($store);
```

---

### 2. Destroy Unused Stores

Clean up stores when no longer needed.

```typescript
const tempStore = createReactor({ data: [] });

// Use store...

// Cleanup when done
tempStore.destroy();
// - Clears history
// - Removes all subscriptions
// - Clears middleware
// - Frees memory
```

**When to Destroy:**
- Route navigation (old page stores)
- Modal close (modal state stores)
- Component unmount (component-local stores)

---

### 3. Limit History Size

Control memory usage with history limits.

**❌ Unlimited History:**
```typescript
undoRedo() // Keeps ALL history → memory grows forever
```

**✅ Limited History:**
```typescript
undoRedo({
  limit: 50 // Keep last 50 changes only
});
```

**Memory Impact:**
```typescript
// Example: 100KB state, 1000 history entries
undoRedo() // ~100MB memory usage
undoRedo({ limit: 50 }) // ~5MB memory usage
```

---

### 4. Use Pick/Omit for Undo/Redo

Exclude large/temporary data from history.

```typescript
const store = createReactor({
  user: { name: 'Alice' }, // Small, undo-able
  cache: { /* 10MB */ }    // Large, not undo-able
}, {
  plugins: [
    undoRedo({
      // Don't save cache in history
      exclude: ['cache:*'] // Action pattern matching
    })
  ]
});
```

---

## Performance Monitoring

### 1. Using Logger Plugin

Track update performance in development.

```typescript
logger({
  trackPerformance: true,  // Measure update duration
  slowThreshold: 10        // Warn if update > 10ms
});

// Console output:
// ⚠️ [Logger] Slow update: addItems took 15.3ms
```

**What to Monitor:**
- Average update time: Should be <5ms
- Slow updates: >10ms indicates bottleneck
- Update frequency: >100 updates/sec may be excessive

---

### 2. DevTools Performance Stats

Use DevTools for detailed performance analysis.

```typescript
const devtools = createDevTools(store);

// Get performance stats
const stats = devtools.inspect();
console.log({
  totalUpdates: stats.history.length,
  avgUpdateTime: calculateAverage(stats),
  slowestUpdate: findSlowest(stats)
});
```

---

### 3. Browser DevTools

Use browser profiling for deep analysis.

**Chrome DevTools:**
1. Performance tab → Record
2. Interact with app
3. Stop recording
4. Look for long tasks (yellow/red)

**What to Look For:**
- Long tasks (>50ms): Indicates slow updates
- Forced reflows: DOM manipulation during updates
- Memory leaks: Growing heap size

---

### 4. Custom Performance Tracking

Add custom tracking for specific operations.

```typescript
const actions = arrayActions(store, 'items');

// Wrap with performance tracking
function addWithTracking(item) {
  const start = performance.now();
  actions.add(item);
  const duration = performance.now() - start;

  if (duration > 10) {
    console.warn(`Slow add: ${duration.toFixed(2)}ms`);
  }
}
```

---

## Common Pitfalls

### Pitfall 1: Deep Cloning Large Objects

**Problem:**
```typescript
const store = createReactor({
  items: Array(10000).fill({ /* complex object */ })
});

store.update(s => {
  s.items.push(newItem); // Clones all 10,000 items!
}); // ~9.4ms
```

**Solution:**
```typescript
// Use arrayActions for better performance
const actions = arrayActions(store, 'items');
actions.add(newItem); // ~2ms
```

**Or:** Use pagination to work with smaller subsets

---

### Pitfall 2: Subscribing in Loops

**❌ Bad:**
```typescript
items.forEach(item => {
  // Creates N subscriptions!
  store.subscribe(state => {
    updateItem(item, state);
  });
}); // Memory leak + poor performance
```

**✅ Good:**
```typescript
// Single subscription
store.subscribe(state => {
  items.forEach(item => {
    updateItem(item, state);
  });
});
```

---

### Pitfall 3: Persisting Temporary Data

**❌ Bad:**
```typescript
const store = createReactor({
  user: { name: 'Alice' },
  tempUIState: { /* should not persist */ },
  cache: { /* 10MB of data */ }
}, {
  plugins: [persist({ key: 'app' })] // Persists everything!
});
```

**✅ Good:**
```typescript
persist({
  key: 'app',
  pick: ['user'], // Only persist user
  // or
  omit: ['tempUIState', 'cache']
});
```

---

### Pitfall 4: Not Debouncing User Input

**❌ Bad:**
```typescript
<input
  value={$store.search}
  on:input={e => store.update(s => { s.search = e.target.value })}
/>
// Updates + persists on EVERY keystroke!
```

**✅ Good:**
```typescript
import { debounce } from 'lodash-es';

const updateSearch = debounce((value) => {
  store.update(s => { s.search = value });
}, 300);

<input
  value={$store.search}
  on:input={e => updateSearch(e.target.value)}
/>
```

---

### Pitfall 5: Creating Stores in Loops

**❌ Bad:**
```typescript
// Component re-renders → creates new store → memory leak!
function Component() {
  const store = createReactor({ value: 0 }); // Don't do this!
  return <div>{$store.value}</div>;
}
```

**✅ Good:**
```typescript
// Create store outside component or use module-level store
const store = createReactor({ value: 0 });

function Component() {
  return <div>{$store.value}</div>;
}
```

---

### Pitfall 6: Over-Engineering Simple State

**❌ Overkill:**
```typescript
// Simple counter doesn't need all this!
const counter = createReactor({ count: 0 }, {
  plugins: [
    undoRedo({ limit: 100 }),
    persist({ key: 'counter', compress: true }),
    logger({ trackPerformance: true }),
    multiTabSync({ key: 'counter' })
  ]
});
```

**✅ Right-sized:**
```typescript
// Simple state = simple setup
const counter = createReactor({ count: 0 });
```

**Rule of Thumb:**
- Small state (<10 fields): No plugins needed
- Medium state (10-100 fields): Persist + maybe undo
- Large state (100+ fields): Optimize as needed
- Complex workflows: Use all features

---

## Benchmarking Your App

### How to Measure Performance

**1. Update Duration**
```typescript
const start = performance.now();
store.update(s => { s.value++; });
const duration = performance.now() - start;
console.log(`Update took: ${duration.toFixed(2)}ms`);
```

**2. Batch Performance**
```typescript
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  store.update(s => { s.count = i; });
}
const duration = performance.now() - start;
console.log(`1000 updates: ${duration.toFixed(2)}ms`);
console.log(`Avg: ${(duration / 1000).toFixed(3)}ms/update`);
```

**3. Memory Usage**
```typescript
// Before
const before = performance.memory?.usedJSHeapSize || 0;

// Do operations
for (let i = 0; i < 1000; i++) {
  store.update(s => { s.items.push({ id: i }) });
}

// After
const after = performance.memory?.usedJSHeapSize || 0;
console.log(`Memory used: ${((after - before) / 1024 / 1024).toFixed(2)}MB`);
```

---

### What Metrics to Track

**Update Performance:**
- ✅ <1ms: Excellent
- ✅ 1-5ms: Good
- ⚠️ 5-10ms: Acceptable
- ❌ >10ms: Needs optimization

**Persistence:**
- ✅ <10ms: Good (with debounce)
- ⚠️ 10-50ms: Acceptable
- ❌ >50ms: Too large/frequent

**Memory:**
- ✅ <10MB: Excellent
- ✅ 10-50MB: Good
- ⚠️ 50-100MB: Monitor
- ❌ >100MB: Likely leak

---

### When to Optimize

**Don't Optimize Prematurely!**

Optimize when you have:
1. **Measured** performance issues (not guessed)
2. **Profiled** to find bottlenecks
3. **Quantified** the problem (metrics)

**Performance Budget:**
```typescript
// Example budget for 60fps (16.67ms frame budget)
const PERFORMANCE_BUDGET = {
  stateUpdate: 5,      // Max 5ms per update
  render: 10,          // Max 10ms for render
  other: 1.67,         // Buffer for other tasks
  total: 16.67         // 60fps frame time
};
```

---

## Real-World Optimization Examples

### Example 1: Optimizing Todo App

**Before:**
```typescript
const todos = createReactor({
  items: [] // Could be 1000s of todos
}, {
  plugins: [
    persist({ key: 'todos', debounce: 0 }), // Slow!
    undoRedo() // Unbounded history
  ]
});

// Slow operations
todos.update(s => s.items.push(newTodo)); // No batch
```

**After:**
```typescript
const todos = createReactor({
  items: []
}, {
  plugins: [
    persist({
      key: 'todos',
      debounce: 500, // Debounced writes
      pick: ['items'] // Only persist todos
    }),
    undoRedo({ limit: 50 }) // Limited history
  ]
});

const actions = arrayActions(todos, 'items', {
  pagination: { pageSize: 50 } // Paginate UI
});

// Fast operations
actions.add(newTodo); // Optimized
actions.addMany([...newTodos]); // Batch add
```

**Results:**
- 10x faster persistence
- 20x less memory usage
- Smooth UI with 1000+ todos

---

### Example 2: Optimizing Form State

**Before:**
```typescript
<input on:input={e => {
  store.update(s => { s.name = e.target.value });
}} />
// Updates + persists on every keystroke!
```

**After:**
```typescript
<script>
import { debounce } from 'lodash-es';

const debouncedUpdate = debounce((value) => {
  store.update(s => { s.name = value });
}, 300);
</script>

<input on:input={e => debouncedUpdate(e.target.value)} />
```

**Results:**
- 90% fewer updates
- Better performance
- Same UX

---

### Example 3: Optimizing Large Dataset

**Before:**
```typescript
const data = createReactor({
  records: Array(10000).fill({...}) // 10,000 records
});

// Render all
{#each $data.records as record}
  <RecordCard {record} />
{/each}
```

**After:**
```typescript
const actions = arrayActions(data, 'records', {
  pagination: { pageSize: 100 }
});

// Render page
{#each actions.getCurrentPage() as record}
  <RecordCard {record} />
{/each}

// Virtual scrolling (advanced)
<VirtualList items={actions.getFilteredItems()} />
```

**Results:**
- 100x fewer DOM nodes
- Instant load time
- Smooth scrolling

---

## Summary

**Key Takeaways:**

1. **Measure First** - Profile before optimizing
2. **Batch Updates** - Combine multiple updates
3. **Debounce I/O** - Reduce persistence/sync frequency
4. **Paginate Large Lists** - Don't render everything
5. **Clean Up** - Unsubscribe and destroy stores
6. **Pick/Omit** - Only persist what's needed
7. **Limit History** - Prevent memory growth
8. **Right-size Features** - Don't over-engineer

**Performance Checklist:**

- [ ] Updates <5ms average
- [ ] Debounced persistence (>100ms)
- [ ] Limited undo history (<100 entries)
- [ ] Paginated large arrays (>100 items)
- [ ] Selective persistence (pick/omit)
- [ ] Proper cleanup (unsubscribe)
- [ ] Compression for large state
- [ ] Memory usage <50MB

**When in Doubt:**
- Start simple
- Measure performance
- Optimize bottlenecks
- Test with real data

For more information, see:
- [API.md](./API.md) - Complete API reference
- [PLUGINS.md](./PLUGINS.md) - Plugin development
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples
