import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // Node environment, not jsdom
    globals: true,
    include: ['tests/**/*.test.js'],
  }
});
