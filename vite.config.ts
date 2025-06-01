import { defineConfig } from 'vite';

export default defineConfig({
  base: "./",
  build: {
    outDir: 'dist/board',
    emptyOutDir: true,
    rollupOptions: {
      input: "./index.html"
    }
  }
});
