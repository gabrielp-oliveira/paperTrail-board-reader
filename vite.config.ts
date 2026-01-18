import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",

  build: {
    outDir: "../portal/src/assets/board",
    emptyOutDir: true,

    rollupOptions: {
      // 🔹 MULTI-ENTRY: index.html + dev.html
      input: {
        index: resolve(__dirname, "index.html"),
        dev: resolve(__dirname, "dev.html"),
      },

      output: {
        // mantém nomes previsíveis
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },

  // 🔹 Dev server (opcional, mas ajuda muito)
  server: {
    port: 5173,
    strictPort: true,
  },
});
