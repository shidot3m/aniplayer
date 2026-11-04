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
  // This limit is the on-demand ceiling, so the default Vite gate stays clean.
  build: {
    chunkSizeWarningLimit: 1024,
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
