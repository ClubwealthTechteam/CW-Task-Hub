// Smoke tests: start the built hub with in-memory storage and click through the main pages as a team
// member and as a super admin. Run `npm run build` first, then `npm run test:smoke`.
import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    // No storage or integrations: the hub runs on in-memory storage, signs in with one shared test code.
    env: { HUB_ACCESS_CODE: 'smoke-test-code', SESSION_SECRET: 'smoke-test-session-secret-0123456789', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' },
  },
});
