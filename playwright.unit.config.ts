// Unit tests: plain functions, no browser and no server. Run with `npm run test:unit`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/unit',
  timeout: 10_000,
  reporter: 'list',
});
