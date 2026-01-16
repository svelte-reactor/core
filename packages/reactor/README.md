# svelte-reactor

> **Compatibility wrapper for [@svelte-reactor/core](https://www.npmjs.com/package/@svelte-reactor/core)**

This package exists for backward compatibility. All new projects should use `@svelte-reactor/core` directly.

## Migration

```bash
# Remove old package
pnpm remove svelte-reactor

# Install new package
pnpm add @svelte-reactor/core
```

Then update your imports:

```typescript
// Before
import { createReactor } from 'svelte-reactor';
import { persist, multiTabSync } from 'svelte-reactor/plugins';

// After
import { createReactor } from '@svelte-reactor/core';
import { persist, sync } from '@svelte-reactor/core/plugins';
```

See the [migration guide](https://github.com/svelte-reactor/core/blob/master/UPGRADES/UPGRADE-0.3.0.md) for more details.
