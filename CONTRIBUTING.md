# Contributing to @svelte-reactor/core

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/svelte-reactor/core.git
cd core
```

2. Install dependencies:
```bash
pnpm install
```

3. Run tests:
```bash
cd packages/core
pnpm test
```

4. Run tests in watch mode:
```bash
pnpm test:watch
```

5. Run benchmarks:
```bash
pnpm bench
```

## Monorepo Structure (v0.3.0+)

```
svelte-dev.reactor/
├── packages/
│   ├── core/                 # @svelte-reactor/core (main library)
│   │   ├── src/
│   │   │   ├── core/         # Core reactor (reactor.svelte.ts)
│   │   │   ├── helpers/      # simpleStore, persistedStore, createForm, arrayActions
│   │   │   ├── plugins/      # undoRedo, persist, sync, logger
│   │   │   ├── devtools/     # DevTools API
│   │   │   ├── storage/      # localStorage, sessionStorage, IndexedDB, memory
│   │   │   ├── utils/        # clone, batch, path utilities
│   │   │   └── types/        # TypeScript definitions
│   │   ├── tests/            # Vitest tests (596+)
│   │   └── templates/        # AI assistant templates
│   │
│   ├── reactor/              # svelte-reactor (compatibility wrapper)
│   │   └── src/index.ts      # Re-exports from @svelte-reactor/core
│   │
│   └── create-reactor/       # CLI scaffolding tool
│
├── examples/
│   └── reactor-demos/        # Interactive demo app
│
├── UPGRADES/                 # Version upgrade guides
├── pnpm-workspace.yaml       # Monorepo workspace config
└── package.json              # Root package.json
```

## Package Commands

All commands are run from `packages/core`:

```bash
cd packages/core

# Development
pnpm dev              # Watch build with Vite
pnpm build            # Production build

# Testing
pnpm test             # Run all 596+ tests
pnpm test:watch       # Watch mode
pnpm test:ui          # UI test runner
pnpm bench            # Run benchmarks

# Quality
pnpm typecheck        # TypeScript strict check
pnpm check            # typecheck + test
pnpm lint             # tsc --noEmit
```

## Making Changes

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes in `packages/core/src/`

3. Add tests for your changes in `packages/core/tests/`

4. Run tests:
```bash
cd packages/core
pnpm test
```

5. Run type checking:
```bash
pnpm typecheck
```

6. Build to verify:
```bash
pnpm build
```

## Pull Request Process

1. Ensure all 596+ tests pass
2. Run `pnpm typecheck` without errors
3. Run `pnpm build` successfully
4. Bundle size must remain < 12 KB gzipped
5. Update documentation if needed:
   - `README.md` - Feature description
   - `API.md` - API documentation
   - `CHANGELOG.md` - Version entry
6. Add a clear description of your changes
7. Link any related issues

## Coding Standards

- Use TypeScript for all code
- Follow existing code style
- Write tests for new features (aim for 90%+ coverage)
- Keep bundle size small (< 12 KB gzipped)
- Document public APIs with JSDoc comments
- Use Svelte 5 runes for reactivity

## Key Files

When contributing, you'll likely work with:

| File | Description |
|------|-------------|
| `src/core/reactor.svelte.ts` | Main Reactor class |
| `src/helpers/form.svelte.ts` | Form helper |
| `src/helpers/simple-store.ts` | Simple store helper |
| `src/plugins/*.ts` | Plugin implementations |
| `src/types/index.ts` | TypeScript definitions |
| `tests/*.test.ts` | Test files |

## Testing

We use Vitest for testing. Tests should:
- Cover all new functionality
- Include edge cases
- Be clear and maintainable
- Include stress tests for performance-critical code

Run specific test files:
```bash
pnpm test tests/form.test.ts
pnpm test tests/reactor.test.ts
```

## Commit Message Format

```
<type>: <description>

Types: feat, fix, docs, test, perf, chore
```

Examples:
```
feat: add cross-field validation to createForm
fix: prevent memory leak in subscription cleanup
docs: update API.md with new form options
test: add stress tests for concurrent updates
```

## Questions?

Feel free to open an issue at [github.com/svelte-reactor/core/issues](https://github.com/svelte-reactor/core/issues).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
