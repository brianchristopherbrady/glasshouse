import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { CLIENT_PORT, COLLECTOR_URL } from "./shared/config.js";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: CLIENT_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: COLLECTOR_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
