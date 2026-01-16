/**
 * Utility exports - ALL INTERNAL ONLY
 * These utilities are used by the library internally but are not exposed to users.
 * Users should not import from 'svelte-reactor/utils' - all necessary APIs are in main exports.
 *
 * Note: Diff utilities were removed in v0.2.9. Use external libraries like 'microdiff' or 'deep-diff'.
 */

// Core utilities (used by reactor, history, plugins)
export { deepClone, smartClone, isEqual } from './clone.js';

// Path utilities (used by persist plugin for pick/omit options)
export { pick, omit, getPath, setPath, deletePath } from './path.js';
