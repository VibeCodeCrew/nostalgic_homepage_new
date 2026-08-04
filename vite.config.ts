import { defineConfig } from 'vite';

// Сборка страницы новой вкладки: index.html + src/main.ts + CSS-модули → dist/
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
