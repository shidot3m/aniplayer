import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  clearScreen: false,
  // Budget: docs/adr/0002; every tier is enforced by tests/test_bundle_split.test.ts.
  // This limit is the largest accepted on-demand chunk (the Anime4K renderer), so the default
  // Vite gate stays clean while the real tiers are the ones the test measures.
  build: {
    chunkSizeWarningLimit: 3600,
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

export default config;
