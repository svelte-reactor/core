import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true,
      },
    }),
    dts({
      include: ['src/**/*.ts', 'src/**/*.svelte.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.bench.ts'],
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'plugins/index': resolve(__dirname, 'src/plugins/index.ts'),
        'helpers/index': resolve(__dirname, 'src/helpers/index.ts'),
        'devtools/devtools': resolve(__dirname, 'src/devtools/devtools.ts'),
        'utils/index': resolve(__dirname, 'src/utils/index.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'svelte',
        'svelte/store',
        'svelte/reactivity',
        'svelte/internal',
        'svelte/internal/client',
        'svelte/internal/server',
        /^svelte\//,  // All svelte/* imports as external
        // CLI deps (not used in browser bundles)
        'kleur',
        'prompts',
        'sade'
      ],
      output: {
        preserveModules: false,
        // Enable manual chunks for better code splitting
        manualChunks: undefined,
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    target: 'esnext',
  },
});
