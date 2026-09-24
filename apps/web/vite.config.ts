import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path only differs for the GitHub Pages project-site build
// (served from https://<user>.github.io/glasshouse/); local dev and any
// other deployment target keep the default root path.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'github-pages' ? '/glasshouse/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
}));
