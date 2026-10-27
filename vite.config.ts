import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  clearScreen: false,
  // Budget: docs/adr/0002; every tier is enforced by tests/test_bundle_split.test.ts.
  // This limit only silences the expected on-demand player/Anime4K chunk sizes.
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
