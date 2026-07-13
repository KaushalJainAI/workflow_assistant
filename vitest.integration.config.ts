import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Integration tests live under tests/integration/ and run against a mocked
// network boundary (MSW). They exercise multiple components together but
// never touch a real backend.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    css: false,
  },
});
