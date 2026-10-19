import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_PORT picks another dev-server port when 5173 is taken.
const PORT = Number(process.env.PLAYWRIGHT_PORT) || 5173;
const baseURL = `http://localhost:${PORT}`;

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a system Chromium instead of the
// browsers downloaded by `npx playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run dev -- --strictPort --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
