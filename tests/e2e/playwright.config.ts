import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

// Absolute path to the project root — ensures reporter always writes
// to QA-Sakura-Solutions/test-results/ regardless of where playwright is invoked from.
const ROOT = path.resolve(__dirname, '../..')

/**
 * Sakura Shield — Playwright Configuration
 * FR: Configuration centrale pour tous les tests E2E de la suite Sakura
 * EN: Central config for all Sakura ecosystem E2E tests
 */
export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['html', { outputFolder: path.join(ROOT, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: path.join(ROOT, 'test-results/results.json') }],
    ['list'],
  ],

  use: {
    baseURL:          process.env.BASE_URL || 'http://localhost:3000',
    trace:            'on-first-retry',
    screenshot:       'only-on-failure',
    video:            'retain-on-failure',
    actionTimeout:    12_000,
    navigationTimeout: 30_000,
  },

  projects: [
    /* ── API contract tests — no browser ── */
    {
      name:      'api',
      use:       {},
      testMatch: '**/api/**/*.spec.ts',
    },
    /* ── Smoke — Desktop Chrome ─── */
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
      testIgnore: '**/api/**/*.spec.ts',
    },
    /* ── Smoke — Mobile ─────────── */
    {
      name:  'mobile-safari',
      use:   { ...devices['iPhone 14'] },
      testIgnore: '**/api/**/*.spec.ts',
    },
    /* ── Visual — Percy ─────────── */
    {
      name:      'visual',
      use:       { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: '**/visual/**/*.spec.ts',
    },
  ],

  /* Dev servers — started automatically if not already running.
     Skipped in CI: The Accused runs locally only (Windows path dependency). */
  webServer: process.env.CI ? [] : [
    {
      command: `node "${path.join(ROOT, 'scripts/start-the-accused.js')}"`,
      url:     'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 120_000,
      stdout:  'pipe',
      stderr:  'pipe',
    },
  ],
})
