import { defineConfig } from 'vite';
// M55 · `vite build --mode diag` emits a separate diagnostics build to dist/diag/ (served at …/broken-vale/diag/).
// __DIAG__ is a compile-time constant: false in the production build, so every diag hook is dead code and is dropped.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __DIAG__: JSON.stringify(mode === 'diag') },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, ...(mode === 'diag' ? { outDir: 'dist/diag' } : {}) },
}));
