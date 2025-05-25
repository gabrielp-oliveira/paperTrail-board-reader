// board/vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../dist"),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        iframe: resolve(__dirname, "iframe.html")
      }
    }
  }
});
