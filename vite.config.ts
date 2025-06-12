import { defineConfig } from 'vite';

export default defineConfig({
  base: "./",
  build: {
    outDir: '../portal/src/assets/board',
    emptyOutDir: true,
    rollupOptions: {
      input: "./index.html"
    }
  }
});
