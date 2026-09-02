import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Unit-test config lives in vitest.config.ts, not here: `test` is not part of
  // vite's own `UserConfig` type, and importing `defineConfig` from
  // `vitest/config` to widen it collides the two nested copies of vite's
  // `Plugin` type. tsconfig.node.json typechecks this file and only this file.
  server: {
    // The app addresses the backend with relative URLs (`/api`, `/ws`) so no
    // build-time environment file is needed — these rules are the dev-mode
    // counterpart of the /api/ and /ws/ blocks in nginx.conf.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    }
  }
})
