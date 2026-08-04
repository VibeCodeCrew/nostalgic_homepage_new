import { defineConfig } from 'vite';

// Сборка service worker'а: src/background/index.ts → dist/background.js (ES-модуль).
// emptyOutDir: false — не затирать результат основной сборки страницы.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/background/index.ts',
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
