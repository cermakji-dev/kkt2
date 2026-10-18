import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['github'], ['list']],
  use: { baseURL: 'http://localhost:3000', locale: 'cs-CZ', timezoneId: 'Europe/Prague', colorScheme: 'dark' },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/login',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { ISYS_E2E_BYPASS: '1', ISYS_E2E_USER_ID: 'e2e-admin', PORT: '3000' },
  },
});
