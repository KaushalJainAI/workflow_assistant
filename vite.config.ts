import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // React Compiler (stable since 1.0): memoizes components and hooks at
    // build time. The chat page re-renders on every streamed frame and had
    // exactly one hand-written `memo`; the compiler does that work everywhere
    // the Rules of React allow, and skips (rather than miscompiles) anything
    // that breaks them — which `eslint-plugin-react-hooks` v7 already reports.
    // plugin-react v6 dropped its own `babel` option; this is the documented
    // replacement.
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code the first paint always needs, in chunks of its own. In
        // one entry chunk with the app shell, every deploy renamed it, so a
        // returning visitor re-downloaded React to pick up a one-line app
        // change. Only libraries the entry imports belong here: a group for
        // something only a lazy page uses (the markdown stack) would pull it
        // forward into the first load.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'router', test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: 'query', test: /[\\/]node_modules[\\/]@tanstack[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  // Unit-test config lives in vitest.config.ts, not here: tsconfig.node.json
  // typechecks this file and only this file, against vite's own `UserConfig`.
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
