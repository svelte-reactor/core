/**
 * Helper functions for common use cases
 * @module @svelte-reactor/core/helpers
 */

export { simpleStore, type WritableStore } from './simple-store.js';
export { persistedStore, persistedReactor, type PersistedStoreOptions } from './persisted-store.js';
export { arrayActions, type ArrayActions, type ArrayActionsOptions } from './array-actions.js';
export { arrayPagination, type ArrayPagination, type ArrayPaginationOptions, type PaginatedResult } from './array-pagination.js';
export { asyncActions, type AsyncActions, type AsyncActionOptions, type AsyncState } from './async-actions.js';
export { computedStore, type ComputedStoreOptions } from './computed-store.js';

// Form helper (v0.3.0)
export {
  createForm,
  type Form,
  type FormOptions,
  type ValidationFn,
  type ValidationRule,
  type ValidationSchema,
  type AsyncValidationFn,
  type ValidateOn,
} from './form.svelte.js';
