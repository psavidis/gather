import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    timezoneId: 'Europe/Athens',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `vite build && vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com',
      VITE_BACKEND_URL: 'https://backend.e2e.test/exec', // see e2e/support/fixtures.ts
    },
  },
});
