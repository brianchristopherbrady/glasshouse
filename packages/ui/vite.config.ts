import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIENT_PORT, COLLECTOR_URL } from "../core/shared/config.js";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
// This config lives at packages/ui/ but builds to the monorepo root's
// dist/ (not packages/ui/dist/) so packages/core/shared/paths.ts's
// PACKAGE_ROOT-relative packagePath("dist") keeps working unchanged for
// the packaged/production static-serving path in packages/core/server/index.ts.
// `root` is set to an ABSOLUTE path (not ".") since npm scripts invoke
// this config via `--config packages/ui/vite.config.ts` from the monorepo
// root -- a relative "." would resolve against that cwd, not this file's
// own directory, and silently fail to find index.html.
export default defineConfig({
  plugins: [react()],
  root: ROOT_DIR,
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
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
