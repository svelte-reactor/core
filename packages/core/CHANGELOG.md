# Changelog

All notable changes to svelte-reactor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-01-10

### New Features

- **`createForm()` Helper** - Reactive form management for Svelte 5
  - Full validation support (sync + async validators)
  - Field-level and form-level validation
  - Configurable validation timing: `change`, `blur`, or `submit`
  - Draft persistence with `persistDraft` option (auto-saves to localStorage)
  - Rich form state: `values`, `errors`, `touched`, `dirty`, `isValid`, `isDirty`, `isSubmitting`
  - Methods: `setField()`, `setFields()`, `setError()`, `clearError()`, `setTouched()`, `validate()`, `validateField()`, `submit()`, `reset()`, `field()`, `destroy()`
  - 94 comprehensive tests including stress tests

### Package Restructure

- **Monorepo Migration** - New scoped package structure
  - Main package renamed to `@svelte-reactor/core`
  - Compatibility wrapper `svelte-reactor` re-exports from `@svelte-reactor/core`
  - Existing imports continue to work with deprecation notice

```typescript
// New (recommended)
import { createReactor } from '@svelte-reactor/core';
import { persist, sync } from '@svelte-reactor/core/plugins';
import { createForm } from '@svelte-reactor/core/helpers';

// Old (still works)
import { createReactor } from 'svelte-reactor';
```

### API Cleanup

- **Deprecated `asyncActions()`** - Will be removed in v0.4.0
  - Use `createQuery()` (coming in v0.4.0) or plain async functions
  - Shows deprecation warning on first use

- **Renamed `multiTabSync` → `sync`** - Shorter, cleaner name
  - `multiTabSync` still works but shows deprecation warning
  - Will be removed in v0.4.0

- **Simplified `logger` plugin options**
  - Renamed `trackPerformance` → `performance`
  - Deprecated rarely used options: `slowThreshold`, `includeTimestamp`, `maxDepth`

### Changed

- Test count increased from 502 to 596 tests (+94 form tests)
- Bundle size maintained < 12 KB gzipped

### Migration Guide

See [UPGRADE-0.3.0.md](../../UPGRADES/UPGRADE-0.3.0.md) for detailed migration instructions.

## [0.2.9] - 2025-01-04

### Breaking Changes

This is a **cleanup release** that removes unnecessary code and simplifies APIs.

- **Removed `batch()` and `batchAll()`** - Use `reactor.batch()` directly
  ```typescript
  // Before: batch(store, () => {...})
  // After:  store.batch(() => {...})
  ```

- **Removed `.value` getter** - Use `.get()` instead
  ```typescript
  // Before: store.value (with deprecation warning)
  // After:  store.get()
  ```

- **Removed `diff()` utility** - Use external libraries like `microdiff` or `deep-diff`
  ```typescript
  // Before: import { diff } from 'svelte-reactor/utils/diff'
  // After:  import diff from 'microdiff'
  ```

- **Extracted `arrayPagination()` from `arrayActions`** - Separate helper for pagination
  ```typescript
  // Before: arrayActions(store, 'items', { pagination: { pageSize: 20 } })
  // After:  const pagination = arrayPagination(store, 'items', { pageSize: 20 })
  ```

- **Removed `subscribe(options)` overload** - Use `select()` instead
  ```typescript
  // Before: store.subscribe({ selector: s => s.name, onChanged: fn })
  // After:  store.select(s => s.name, fn)
  ```

- **Simplified `asyncActions`** - Removed retry, debounce, and parallel mode
  ```typescript
  // Before: asyncActions(store, actions, { retry: {...}, debounce: 300, concurrency: 'parallel' })
  // After:  asyncActions(store, actions, { concurrency: 'replace' | 'queue' })
  // Use lodash-es/debounce or implement retry at API layer
  ```

- **Removed localStorage fallback in sync plugin** - Requires BroadcastChannel (95%+ browser support)

### Added

- **`arrayPagination()` helper** - Standalone pagination for array fields
  - `getPage()`, `setPage()`, `nextPage()`, `prevPage()`, `firstPage()`, `lastPage()`
  - `getCurrentPage()`, `getTotalPages()`
  - Works independently of `arrayActions`

- **`onReady` callback for IndexedDB persistence** - Notifies when async data is loaded
  ```typescript
  persist({
    key: 'data',
    storage: 'indexedDB',
    onReady: (loadedState) => console.log('Ready:', loadedState)
  })
  ```

- **`onError` callback for asyncActions** - Centralized error handling
  ```typescript
  asyncActions(store, actions, {
    onError: (error, actionName) => console.error(`${actionName} failed:`, error)
  })
  ```

- **4 new tests** (505 total)

### Fixed

- **IndexedDB persistence not loading on page reload** - Data now loads correctly via `onReady` callback

### Changed

- **Bundle size reduced** - 11.52 KB gzipped (was 11.67 KB)
- **Simpler API surface** - Fewer ways to do the same thing
- **`select()` is now the primary API for selective subscriptions**

## [0.2.8] - 2025-12-27

### Added

- **`.value` deprecation warning** - Helps users migrating from other libraries
  - `.value` now returns correct value with deprecation warning in console
  - Use `.get()` instead (no warning, recommended)
  - Hidden from `Object.keys()` and TypeScript autocomplete (`enumerable: false`)
  - Backward compatible - `.value` still works but shows warning

- **`simpleStore` and `persistedStore` API documentation** - Complete API reference
  - Full documentation with `.get()` examples
  - Store methods comparison table added to README and QUICK_START
  - AI templates updated with `.get()` usage

- **15 new tests** for `.value` deprecation (501 total)

### Changed

- **Lazy lz-string loading** - Bundle size optimization
  - lz-string is now loaded dynamically only when `compress: true` is used
  - Separate chunk for lz-string (2.16 KB gzipped)
  - Reduces main persist-plugin size when compression not used
  - Transparent to users - no API changes needed

- **Updated AI templates** - Added `.get()` examples and `.value` deprecation warning
  - `claude.md`, `cursor.md`, `copilot.md` updated
  - Store methods comparison table added

### Fixed

- **`.value` returning undefined** - Real user issue where `.value` returned undefined instead of expected data
  - Now returns correct value via `.get()` internally
  - Deprecation warning guides users to correct API

## [0.2.7] - 2025-12-18

### Added

- **`reactor.select()` Method** - Simpler API for selective subscriptions
  - Cleaner syntax: `store.select(selector, callback, options)`
  - Same functionality as `subscribe({ selector, onChanged })`
  - Recommended for new code

- **`ReactorError` Class** - Custom error class with rich debugging context
  - Context includes: reactor name, action, plugin, state, cause, tip
  - Formatted output: `[Reactor:name] message`
  - Static factory methods: `destroyed()`, `invalidState()`, `pluginError()`, `withTip()`

- **`asyncActions` Concurrency Control** - Handle race conditions
  - `concurrency: 'replace'` - Cancel previous request, only latest completes (default)
  - `concurrency: 'queue'` - Queue requests, execute sequentially
  - `concurrency: 'parallel'` - All requests run in parallel
  - Request ID tracking to ignore stale responses

- **11 new tests** for v0.2.7 features (486 total)

### Changed

- **DevTools subscription** - Changed from polling (setInterval 100ms) to real subscription
  - Major CPU usage reduction
  - Eliminates memory leak from continuous cloning
  - Only fires when state actually changes

- **Optimized cloning in notifySubscribers** - Clone states once and reuse
  - ~50% reduction in cloning operations
  - Better performance for stores with many subscribers

- **`diff.ts` moved to optional import** - Reduces main bundle size
  - Before: `import { diff } from 'svelte-reactor/utils'`
  - After: `import { diff } from 'svelte-reactor/utils/diff'`
  - ~500 bytes savings in main bundle

- **AI instruction templates optimized** - 79% smaller (2430 → 498 lines)
  - `claude.md`: 212 lines (XML tags for structure)
  - `cursor.md`: 192 lines (IDE context focus)
  - `copilot.md`: 94 lines (inline completions)
  - Each tailored to AI's specific capabilities

- **Value store factory** - Internal refactoring
  - Eliminated ~50 lines of duplication between `simpleStore` and `persistedStore`

### Fixed

- DevTools polling causing high CPU usage and memory leaks
- Race conditions in async actions with rapid sequential calls

## [0.2.5] - 2025-01-24

### Added

- **Selective Subscriptions (Phase 3.1)** - Subscribe to specific state parts for better performance
  - New `subscribe({ selector, onChanged, fireImmediately, equalityFn })` overload
  - Callback only fires when selected value changes (not entire state)
  - Supports nested paths and custom equality functions
  - Deep equality with `isEqual` utility for arrays/objects
  - Perfect for form validation, component optimization, expensive computations
  - +12 comprehensive tests covering all scenarios
  - +~0.5 KB gzipped (opt-in, only when used)

- **Computed Stores (Phase 3.2)** - Memoized computed state with dependency tracking
  - New `computedStore(source, compute, options)` helper
  - `keys` option for fine-grained dependency tracking (only recompute when specified fields change)
  - `equals` option for custom result equality (prevents unnecessary updates)
  - Supports nested paths: `'user.profile.name'`
  - Returns Svelte-compatible `Readable<R>` store
  - Works seamlessly with `derived()`, `get()`, and `$store` syntax
  - Performance: 2-10x faster for expensive computations
  - Stable references (prevents re-renders when content unchanged)
  - +14 comprehensive tests covering all scenarios
  - +~1.2 KB gzipped (tree-shakeable)

- **Performance Optimizations (Phase 4.3)** - Critical path optimizations
  - Optimized `smartClone()` for hot path (2x faster for simple objects)
  - Inlined critical type checks (removes function call overhead)
  - Pre-allocated arrays in batch operations (10x faster for large batches)
  - Specialized clone paths for common patterns
  - Zero overhead for simple updates (primitives, flat objects)
  - Performance gain: 2-10x faster for critical operations

- **Batch Utilities** - New batch helper functions
  - `batch()` - Execute multiple reactor updates in a batch
  - `batchAll()` - Batch updates across multiple reactors
  - `batched()` - Create a batched version of any function
  - `debouncedBatch()` - Debounced batch updates
  - All utilities exported from main package
  - +~0.3 KB gzipped (tree-shakeable)

### Changed

- Test count increased from 326 to 475 tests (+149 tests)
  - +12 tests for selective subscriptions
  - +14 tests for computed stores
  - +8 tests for batch utilities
  - +115 tests for performance optimizations and edge cases
- Bundle size decreased from 14.68 KB to 11.04 KB gzipped (-3.64 KB, -24.8%)
  - Core optimizations: -2.5 KB
  - Tree-shaking improvements: -1.14 KB
  - New features (opt-in): +0.5 KB (selective subs) + 1.2 KB (computed stores) + 0.3 KB (batch utils) = +2.0 KB only when used
  - Net reduction: -3.64 KB (-24.8%)
- Documentation comprehensively updated:
  - README.md: Added selective subscriptions and computed stores sections
  - API.md: Complete API documentation for new features
  - EXAMPLES.md: 5 comprehensive computed store patterns, 5 selective subscription patterns
  - AI templates (claude.md, cursor.md, copilot.md): Updated with v0.2.5 features
  - UPGRADE-0.2.5.md: Migration guide created

### Fixed

- Deep equality for key comparison in `computedStore()` (handles smartClone creating new objects)
- Subscription notification logic (only notifies when value actually changes)
- Proper `Readable<R>` implementation for `computedStore()` (works with `get()`)

## [0.2.4] - 2025-01-19

### Added

- **Derived Stores Export** - Convenience re-exports for single-import workflow
  - `derived()` - Create computed stores from one or more stores
  - `get()` - Get current value from any store (one-time read)
  - `readonly()` - Create read-only version of a store
  - All re-exported from `svelte/store` for convenience
  - No need to import from both `svelte-reactor` and `svelte/store`
  - Zero bundle size impact (re-exports only)
  - Full TypeScript support

- **IndexedDB Storage Support** - 50MB+ capacity for large datasets
  - New `storage: 'indexedDB'` option for persist plugin
  - `indexedDB` configuration object with database, storeName, and version
  - Transparent async handling with in-memory cache
  - Auto-flush pending writes on page unload (no data loss)
  - Perfect for photos, documents, offline data, game saves
  - Tree-shakeable (+1.2 KB gzipped only when used)
  - 36 comprehensive tests covering all scenarios
  - Full TypeScript support with configuration interface

- **TTL (Time-To-Live) Support** - Auto-expire cached data
  - `ttl` option in milliseconds for persist plugin
  - `onExpire(key)` callback when data expires
  - Automatic timestamp tracking and age checking
  - Works with all storage types (localStorage, sessionStorage, indexedDB, memory)
  - Perfect for API caches, session management, temporary data
  - Compatible with migrations (TTL check runs before migrations)
  - Zero bundle size impact (minimal code)
  - 19 comprehensive tests including edge cases

- **Pagination Helper** - Built-in pagination for arrayActions
  - `pagination` option with `pageSize` and `initialPage` configuration
  - `getPaginated()` method returning items with full metadata
  - Navigation methods: `nextPage()`, `prevPage()`, `setPage()`, `firstPage()`, `lastPage()`
  - 1-indexed pages (user-friendly)
  - Auto-clamping to valid page range
  - Works seamlessly with all arrayActions methods (sort, filter, etc.)
  - Opt-in (no overhead when not used)
  - 29 comprehensive tests covering all scenarios
  - +0.41 KB gzipped

- **Storage Type Safety** - TypeScript union types + runtime validation
  - `storage` parameter now uses TypeScript union type
  - Catches typos at compile time ('localstorage' ❌ → 'localStorage' ✅)
  - Runtime validation for storage parameter
  - Better IntelliSense autocomplete
  - Zero bundle size impact (types only)

- **AI Setup Fix** - `init-ai` now creates files AI assistants actually read
  - **Claude Code**: Creates `.claude/README.md` (automatically read by Claude)
  - **Cursor AI**: Creates `.cursorrules` (automatically read by Cursor)
  - **GitHub Copilot**: Creates `.github/copilot-instructions.md`
  - Added `--merge` flag to merge with existing files
  - Added `--force` flag to overwrite existing files
  - Better CLI output messages
  - 10 new tests for CLI generators

### Changed

- Test count increased from 232 to 326 tests (+94 tests)
  - +36 tests for IndexedDB storage
  - +19 tests for TTL support
  - +29 tests for pagination
  - +10 tests for DX improvements
- Bundle size increased from 13.27 KB to 14.68 KB gzipped (+1.41 KB, +10.6%)
  - IndexedDB: +1.2 KB (tree-shakeable, only when used)
  - Pagination: +0.41 KB (opt-in)
  - TTL: minimal impact (~0.1 KB)
  - Derived stores: 0 KB (re-exports only)
- All new features are tree-shakeable and opt-in
- Documentation comprehensively updated:
  - README.md updated with all v0.2.4 features
  - API.md updated with new options and methods
  - All AI templates updated (CLAUDE.md, cursor.md, copilot.md)
  - UPGRADE-0.2.4.md migration guide created

### Fixed

- **init-ai command**: Fixed file paths to match what AI assistants actually read
  - Claude Code now reads `.claude/README.md` instead of `.claude/SVELTE_REACTOR_RULES.md`
  - Cursor AI now reads `.cursorrules` instead of `.cursor/SVELTE_REACTOR_RULES.md`
  - GitHub Copilot support added with `.github/copilot-instructions.md`

## [0.2.3] - 2025-11-10

### Added

- **persist Plugin Enhancement** - Selective persistence with `pick` and `omit` options
  - `pick: string[]` - Only persist specific fields (supports dot notation)
  - `omit: string[]` - Exclude specific fields from persistence (supports dot notation)
  - Security: Prevent sensitive data (tokens, passwords) from being persisted
  - Performance: Reduce localStorage usage by excluding temporary data
  - Cannot use both `pick` and `omit` together
  - 8 comprehensive tests added

- **arrayActions Helper Enhancement** - Sorting and bulk operations
  - `sort(compareFn)` - Sort array with comparator function (supports undo/redo)
  - `bulkUpdate(ids, updates)` - Update multiple items at once
  - `bulkRemove(idsOrPredicate)` - Remove multiple items by ids or predicate
  - More efficient than calling individual methods multiple times
  - All methods support undo/redo with single history entry
  - 13 comprehensive tests added

- **asyncActions Helper Enhancement** - Retry logic, debouncing, and cancellation
  - Retry configuration with exponential/linear backoff strategies
    - `retry.attempts` - Number of retry attempts (default: 3)
    - `retry.delay` - Delay between retries in ms (default: 1000)
    - `retry.backoff` - 'exponential' or 'linear' (default: 'exponential')
    - `retry.retryOn` - Custom retry condition function
  - Debouncing support with `debounce` option (in milliseconds)
  - Request cancellation with `controller.cancel()`
  - Returns AsyncController for manual cancellation
  - 14 comprehensive tests added

- **logger Plugin Enhancement** - Advanced filtering and performance tracking
  - `filter(action, state, prevState)` - Filter function with access to action and state
  - `trackPerformance` - Track execution time for each action
  - `slowThreshold` - Warn if action execution time exceeds threshold (in ms)
  - `includeTimestamp` - Add timestamp to logs
  - `maxDepth` - Limit object depth in console (default: 3)
  - 12 comprehensive tests added

- **Integration Tests** - 5 comprehensive integration tests for v0.2.3 features
  - Test complex scenarios combining multiple features
  - Verify feature interactions work correctly

### Fixed

- **CRITICAL**: Fixed unhandled promise rejection when cancelling non-debounced async actions
  - Properly handle promise chains during cancellation
  - Added comprehensive error handling for all cancellation scenarios
- **persist plugin**: Fixed empty `pick: []` array not working correctly
- **asyncActions**: Fixed debounce cancellation not properly handling promise chains
- **State consistency**: Fixed edge cases in state updates for bulk operations

### Changed

- Test count increased from 174 to 232 tests (+58 tests)
- Bundle size increased from 10.87 KB to 13.27 KB gzipped (+2.4 KB)
- Documentation updated with v0.2.3 features and examples
- All new features are tree-shakeable

## [0.2.2] - 2025-10-18

### Fixed
- **Memory leaks** - Fixed memory leaks in core reactor
  - Subscribers Set is now properly cleared on destroy()
  - Middlewares array is now properly cleared on destroy()
  - Prevents memory leaks when reactors are destroyed and recreated

- **Performance optimization** - Skip unnecessary updates when state unchanged
  - Added deep equality check before running middlewares and notifying subscribers
  - Improves performance by avoiding re-renders when state hasn't actually changed
  - Uses existing `isEqual()` utility for reliable comparison

- **Error handling** - Enhanced error messages and validation
  - Added validation for createReactor initialState (must be non-null object)
  - Added validation for reactor name (must be non-empty string)
  - Added validation for subscribe() parameter (must be function)
  - Added validation for update() parameter (must be function)
  - Added validation for persist plugin options (key required, debounce must be number)
  - Improved error messages with reactor name context
  - Better error recovery in persist plugin (auto-cleanup corrupted data)
  - Quota exceeded detection in persist plugin with helpful error messages

- **Documentation links** - Fixed broken links in README for NPM package
  - Added API.md, EXAMPLES.md, PERFORMANCE.md to published files
  - Fixed CONTRIBUTING.md link to use GitHub URL
  - Fixed LICENSE link to use relative path

### Changed
- Test count increased from 172 to 181 tests (+9 tests for bug fixes)
- More descriptive error messages include reactor name for easier debugging

## [0.2.1] - 2025-01-16

### Added
- **Async Actions Helper** - Automatic loading/error state management for async operations
  - `asyncActions()` helper function with full TypeScript support
  - Automatic `loading` and `error` state handling
  - Customizable field names (`loadingKey`, `errorKey`)
  - 23 comprehensive tests including 3 advanced complexity tests:
    - Concurrent async operations handling
    - Race condition management
    - Complex nested operations with error recovery
  - Works seamlessly with undo/redo plugin

### Changed
- **Enhanced Migration Guide** - Added detailed examples for:
  - Working with Arrays (arrayActions helper)
  - Async Operations (asyncActions helper)
  - Before/After comparisons with manual approaches
- Test count increased from 149 to 172 tests (+23 tests)
- Bundle size slightly increased to 12.22 KB gzipped (was 11.95 KB)
- Documentation updated with asyncActions examples

## [0.2.0] - 2025-01-16

### Added
- **Array Actions Helper** - Reduce boilerplate for common array CRUD operations
  - `arrayActions()` helper function for creating CRUD actions
  - 11 built-in methods: `add`, `update`, `updateBy`, `remove`, `removeWhere`, `clear`, `toggle`, `set`, `filter`, `find`, `has`, `count`
  - Full TypeScript type inference for array items
  - Compatible with undoRedo plugin
  - 21 comprehensive tests

### Fixed
- **persist plugin sync** - Fixed cross-tab/window synchronization for localStorage
  - Added `storage` event listener for detecting external changes
  - Changes from other tabs are now automatically synced (localStorage)
  - Manual changes in DevTools are now detected (both localStorage and sessionStorage)
  - Proper cleanup of event listeners on destroy()
  - 2 new tests for storage synchronization

### Changed
- Test count increased from 93 to 149 tests (+56 tests)
- Documentation updated with arrayActions examples
- Added Array Actions to main features list

## [0.1.1] - 2025-01-14

### Fixed
- Updated package name from `svelte-reactor` to `svelte-reactor` across all documentation and examples
- Fixed GitHub repository links to point to correct repository (svelte-reactor/core)
- Removed references to non-existent `@svelte-dev/persist` package
- Fixed GitHub Actions workflows to use correct package names
- Updated root README to display correct project information

## [0.1.0] - 2025-01-13

### Added

#### Core Features
- `createReactor()` - Main function for creating reactive state management
- Reactive state with Svelte 5 `$state` runes
- `update()` method with optional action parameter for state updates
- `set()` method for direct state replacement
- `batch()` method for grouping multiple updates
- `destroy()` method for cleanup

#### Undo/Redo System
- Full undo/redo functionality with `undoRedo()` plugin
- History management with configurable limits (default: 50)
- `undo()` and `redo()` methods
- `canUndo()` and `canRedo()` state checks
- `clearHistory()` for resetting history
- `getHistory()` for accessing history stack
- Batch operations support
- Action exclusion with `exclude` option
- History compression with `compress` option
- Action grouping with `groupByAction` option

#### Plugin System
- Flexible plugin architecture with `ReactorPlugin` interface
- `persist()` plugin for automatic state persistence
  - Support for localStorage, sessionStorage
  - Configurable debounce
  - Schema versioning and migrations
  - Direct storage access (no $effect dependency)
- `logger()` plugin for development debugging
  - Collapsible console groups
  - Custom logger functions
- Plugin lifecycle methods (init, destroy)

#### Middleware System
- Middleware chain for intercepting state changes
- `onBeforeUpdate` and `onAfterUpdate` hooks
- Error handling with `onError`
- Custom middleware support

#### DevTools API
- `createDevTools()` for advanced debugging
- Time-travel debugging with `timeTravel()`
- State export/import as JSON
- `reset()` to initial state
- `getStateAt()` for historical state access
- `subscribe()` for external devtools integration
- Full state inspection with `inspect()`

#### Utilities
- `diff()` - Calculate state differences
- `applyPatch()` - Apply state patches
- `getChangeSummary()` - Get change statistics
- `deepClone()` - Deep object cloning with structuredClone
- `isEqual()` - Deep equality comparison

#### Performance
- Bundle size: 12.07 KB gzipped (full package)
- Plugins only: 1.03 KB gzipped
- Tree-shakeable exports
- Simple updates: < 0.1ms
- Undo/redo overhead: < 0.1ms
- Comprehensive benchmarks included

#### Documentation
- Complete README.md with examples
- Full API reference (API.md)
- Real-world examples (EXAMPLES.md)
  - Counter with undo/redo
  - Todo app with persistence
  - Shopping cart
  - Canvas editor
  - Form management
- Performance documentation (PERFORMANCE.md)
- TypeScript definitions for all APIs

#### Testing
- 93 comprehensive tests
- Unit tests for all core features
- Integration tests for plugins
- DevTools tests
- Utilities tests (40 tests)
- Performance benchmarks
- 100% TypeScript coverage

### Technical Details

#### Dependencies
- Svelte 5 (peer dependency)
- Zero external runtime dependencies

#### TypeScript
- Full TypeScript support
- Strict type checking
- Exported types for all APIs
- Generic type support for state

#### Browser Support
- Modern browsers with ES2020+ support
- SSR-safe for SvelteKit
- Works in all environments that support Svelte 5

### Breaking Changes
- None (initial release)

### Migration Guide
- None (initial release)

---

## Release Notes Template

### [Version] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes to existing features

#### Deprecated
- Features that will be removed in future versions

#### Removed
- Features that were removed

#### Fixed
- Bug fixes

#### Security
- Security improvements

---

## Roadmap

### v0.3.0 (Planned)
- State Snapshots API
- Performance Monitoring Plugin
- Validation Plugin
- Form Helpers
- SSR Improvements

### v1.0.0 (Future)
- Redux DevTools extension support
- Advanced state diffing algorithms
- React/Vue adapters for cross-framework usage
- Plugin marketplace

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

MIT License - see [LICENSE](./LICENSE) for details
