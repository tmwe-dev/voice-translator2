import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.{js,jsx}'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./__tests__/setup.js'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['app/lib/**/*.js'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
