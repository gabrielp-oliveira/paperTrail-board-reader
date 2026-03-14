import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",

  build: {
    outDir: "../portal/src/assets/board",
    emptyOutDir: true,
    minify: "esbuild",
    target: "es2020",
    cssMinify: true,

    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        dev: resolve(__dirname, "dev.html"),
      },

      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: {
          d3: ["d3"],
        },
      },
    },
  },

  server: {
    port: 5173,
    strictPort: true,
  },
});
