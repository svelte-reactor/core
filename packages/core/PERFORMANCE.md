# Performance Benchmarks

## Bundle Size

- **Main Bundle (index.js)**: 35.24 KB → **10.66 KB gzipped** ✅ (-1.39 KB from v0.2.4, -11.5%)
- **Helpers (separate)**: 0.23 KB → **0.18 KB gzipped** ✅
- **Plugins Only**: 8.20 KB → **2.56 KB gzipped** ✅
- **Persist Plugin**: 23.22 KB → **5.64 KB gzipped** ✅
- **DevTools**: 2.03 KB → **0.87 KB gzipped** ✅
- **Tree-shakeable**: Yes ✅

**Total Package Size Analysis:**
- If you only use core: **10.66 KB**
- If you add persist: **10.66 KB + 5.64 KB = 16.30 KB**
- If you add all plugins: **10.66 KB + 2.56 KB = 13.22 KB**
- Full package (everything): **~20 KB gzipped**

**Note:** Bundle size **reduced 27.5%** in v0.2.5 due to optimizations:
- **Phase 4.2 optimizations (-11.5%)**: separate helpers entry, enhanced tree-shaking, external deps
- **Phase 0 minification (-19.6%)**: esbuild minification enabled
- Aggressive API cleanup - removed all utility exports (-7% API surface)
- Removed 15 unused/internal exports total (-27% API surface from 67 → 52)
- Memory Storage support (+0 KB, tree-shakeable)
- **Compression support (+0 KB base, tree-shakeable)** - lz-string only loaded when `compress: true`
- Previous v0.2.4 size: 65.94 KB → 14.68 KB gzipped

**Previous increases (v0.2.4):**
- IndexedDB storage support (+1.2 KB, tree-shakeable, only when used)
- Pagination helper for arrayActions (+0.41 KB, opt-in)
- TTL (Time-To-Live) support (~0.1 KB)
- Derived stores export (0 KB, re-exports only)
- Storage type safety (0 KB, types only)

**Previous increases (v0.2.3):**
- Retry logic with backoff algorithms (+0.8 KB)
- Debounce & cancellation support (+0.6 KB)
- Advanced logger filtering (+0.5 KB)
- Path utilities for pick/omit (+0.3 KB)
- Bulk operations for arrays (+0.2 KB)

**Version History:**
- **v0.2.5**: 10.66 KB (-27.5%) ← Current
- v0.2.4: 14.68 KB (+10.6%)
- v0.2.3: 13.27 KB (+9.3%)
- v0.2.2: 12.14 KB (baseline)

**Comparison with Other Libraries:**
| Library | Gzipped Size | Features |
|---------|--------------|----------|
| Zustand | 2.9 KB | Minimal state management |
| Redux Toolkit | ~12 KB | State + middleware |
| MobX | ~16 KB | Full reactive system |
| Recoil | ~21 KB | Atom-based state |
| **svelte-reactor** | **10.66 KB** | **Full-featured + SSR + Undo/Redo** ✅ |

**Key Advantages:**
- ✅ **Smaller than MobX** (16 KB) while offering more features
- ✅ **Competitive with Redux Toolkit** (12 KB) with better DX
- ✅ **Native Svelte 5 integration** with runes + stores compatibility
- ✅ **Production-ready** with SSR, DevTools, persistence, undo/redo

## Benchmark Results

### State Updates

| Operation | Operations/sec | Mean (ms) |
|-----------|----------------|-----------|
| Simple state update | **26,884** | 0.037 |
| Complex state update | **14,060** | 0.071 |
| 100 sequential updates | **331** | 3.018 |

**Key Takeaways:**
- Single updates are extremely fast (**< 0.1ms**)
- Complex state changes maintain good performance
- Batch operations scale linearly

### Undo/Redo Performance

| Operation | Operations/sec | Mean (ms) |
|-----------|----------------|-----------|
| Update with undo/redo | **11,636** | 0.086 |
| 100 updates with history | **185** | 5.414 |
| Batch 100 updates | **267** | 3.750 |

**Key Takeaways:**
- Undo/Redo adds minimal overhead (~0.05ms per operation)
- Batching significantly improves performance for multiple updates
- History tracking has acceptable overhead

### History Operations

| Operation | Operations/sec | Mean (ms) |
|-----------|----------------|-----------|
| 50 undos | **318** | 3.141 |
| 50 redos | **323** | 3.099 |

**Key Takeaways:**
- Undo/redo operations are symmetric in performance
- ~60µs per undo/redo operation
- Excellent for interactive applications

### Large State Performance

| Operation | Operations/sec | Mean (ms) |
|-----------|----------------|-----------|
| Update large array (1000 items) | **107** | 9.384 |
| Update large object (100 properties) | **2,916** | 0.343 |

**Key Takeaways:**
- Object updates scale better than array updates
- Large state still maintains reasonable performance
- Deep cloning is the main bottleneck for large arrays

### Reactor Creation

| Operation | Operations/sec | Mean (ms) |
|-----------|----------------|-----------|
| Create simple reactor | **558,098** | 0.0018 |
| Create with complex state | **296,729** | 0.0034 |
| Create with undo/redo | **40,595** | 0.0246 |

**Key Takeaways:**
- Reactor creation is extremely fast
- Undo/redo plugin adds ~0.02ms overhead
- Complex state has minimal impact

## Performance Goals

✅ **Update operations**: < 1ms for simple updates
✅ **Undo/Redo**: < 0.1ms overhead per operation
✅ **Bundle size**: < 15KB gzipped (full package) - **Now 11.75 KB! 🎉**
✅ **Memory**: Reasonable memory usage with history limits

## Optimization Opportunities

1. **Large Array Updates**: Consider using patches instead of full clones
2. **History Compression**: Already implemented for identical consecutive states
3. **Selective Serialization**: Use shallow comparison for updates (future)

## Running Benchmarks

```bash
cd packages/reactor
pnpm bench
```

## System Information

- **Node Version**: v18+
- **Platform**: Cross-platform (Windows, macOS, Linux)
- **Test Environment**: vitest bench runner
