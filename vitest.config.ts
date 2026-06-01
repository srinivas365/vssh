import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
});
