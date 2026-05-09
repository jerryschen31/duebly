import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './web/tests/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CI
      ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173'
      : 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
