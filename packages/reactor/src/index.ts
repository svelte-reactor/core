/**
 * svelte-reactor - Compatibility wrapper for @svelte-reactor/core
 *
 * @deprecated This package is a compatibility wrapper. Please migrate to @svelte-reactor/core.
 * @see https://github.com/svelte-reactor/core/blob/master/UPGRADES/UPGRADE-0.3.0.md
 */

// Show deprecation notice (once per session)
let hasShownNotice = false;

if (typeof console !== 'undefined' && !hasShownNotice) {
  hasShownNotice = true;
  console.info(
    '[svelte-reactor] Consider migrating to @svelte-reactor/core for new projects.\n' +
    'See: https://github.com/svelte-reactor/core/blob/master/UPGRADES/UPGRADE-0.3.0.md'
  );
}

// Re-export everything from @svelte-reactor/core
export * from '@svelte-reactor/core';
