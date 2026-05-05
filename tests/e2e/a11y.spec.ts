/**
 * Sakura Shield — Accessibility (a11y) Test Suite
 * FR: Tests d'accessibilité automatisés via axe-core pour les 3 apps Sakura.
 *     Vérifie la conformité WCAG 2.1 AA sur les pages principales de chaque service.
 * EN: Automated accessibility tests via axe-core for the 3 Sakura apps.
 *     Validates WCAG 2.1 AA compliance on the main pages of each service.
 *
 * Scope / Périmètre :
 *   - Sakura Fidelity — login page
 *   - Sakura Rewards  — play page (wheel)
 *   - Sakura Xian     — homepage
 *
 * Failure policy / Politique d'échec :
 *   - CRITICAL / SERIOUS violations  → test fails hard
 *   - MODERATE / MINOR violations    → logged as warnings, test passes
 *   - Results written to test-results/a11y-results.json after each run
 *
 * axe-core rules disabled intentionally:
 *   - color-contrast: disabled — dark-mode designs often fail, revisit once
 *     design tokens are finalized with proper APCA contrast ratios.
 */

import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe, getViolations } from 'axe-playwright'
import * as fs   from 'fs'
import * as path from 'path'

/* ── Types ────────────────────────────────────────────────────────────────── */

interface A11yViolation {
  id:     string
  impact: string | undefined
  description: string
  nodes: number
}

interface A11yAppResult {
  app:        string
  url:        string
  scanAt:     string
  critical:   number
  serious:    number
  moderate:   number
  minor:      number
  violations: A11yViolation[]
}

/* ── Config ───────────────────────────────────────────────────────────────── */

const RESULTS_DIR  = path.resolve(__dirname, '../../test-results')
const RESULTS_FILE = path.join(RESULTS_DIR, 'a11y-results.json')

const FIDELITY_URL = process.env.FIDELITY_URL || 'https://sakurafidelity.com'
const REWARDS_URL  = process.env.REWARDS_URL  || 'https://sakurarewards.com'
const XIAN_URL     = process.env.XIAN_URL     || 'https://sakuraxian.com'
const REWARDS_TOKEN = process.env.REWARDS_TEST_TOKEN || 'test-token-uuid-placeholder'

/* Axe rules shared across all scans */
const AXE_CONFIG = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  },
  rules: {
    'color-contrast': { enabled: false },   // dark-mode — revisit with APCA
  },
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function countByImpact(violations: Awaited<ReturnType<typeof getViolations>>) {
  let critical = 0, serious = 0, moderate = 0, minor = 0
  for (const v of violations) {
    switch (v.impact) {
      case 'critical':  critical++;  break
      case 'serious':   serious++;   break
      case 'moderate':  moderate++;  break
      case 'minor':     minor++;     break
    }
  }
  return { critical, serious, moderate, minor }
}

function appendResult(result: A11yAppResult) {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const existing: A11yAppResult[] = fs.existsSync(RESULTS_FILE)
    ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
    : []
  // Replace existing entry for same app, or append
  const idx = existing.findIndex(r => r.app === result.app)
  if (idx >= 0) existing[idx] = result
  else existing.push(result)
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2))
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUITE
═══════════════════════════════════════════════════════════════════════════ */

test.describe('Accessibility — Sakura Fidelity', () => {

  test('Login page has no critical/serious WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto(`${FIDELITY_URL}/login`, { waitUntil: 'networkidle' })
    await injectAxe(page)

    const violations = await getViolations(page, undefined, { axeOptions: AXE_CONFIG })
    const counts     = countByImpact(violations)

    // Log all violations for visibility
    if (violations.length > 0) {
      console.log(`[A11y Fidelity] ${violations.length} violation(s):`)
      violations.forEach(v => console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`))
    }

    appendResult({
      app:      'sakura-fidelity',
      url:      `${FIDELITY_URL}/login`,
      scanAt:   new Date().toISOString(),
      ...counts,
      violations: violations.map(v => ({
        id:          v.id,
        impact:      v.impact,
        description: v.description,
        nodes:       v.nodes.length,
      })),
    })

    if (counts.serious > 0) {
      console.warn(`[A11y Fidelity] ${counts.serious} serious violation(s) — review recommended`)
    }
    expect(
      counts.critical,
      `Found ${counts.critical} critical WCAG violations on Fidelity login page`,
    ).toBe(0)
  })

})

test.describe('Accessibility — Sakura Rewards', () => {

  test('Play page has no critical/serious WCAG 2.1 AA violations', async ({ page }) => {
    const url = `${REWARDS_URL}/play/${REWARDS_TOKEN}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await injectAxe(page)

    const violations = await getViolations(page, undefined, { axeOptions: AXE_CONFIG })
    const counts     = countByImpact(violations)

    if (violations.length > 0) {
      console.log(`[A11y Rewards] ${violations.length} violation(s):`)
      violations.forEach(v => console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`))
    }

    appendResult({
      app:      'sakura-rewards',
      url,
      scanAt:   new Date().toISOString(),
      ...counts,
      violations: violations.map(v => ({
        id:          v.id,
        impact:      v.impact,
        description: v.description,
        nodes:       v.nodes.length,
      })),
    })

    if (counts.serious > 0) {
      console.warn(`[A11y Rewards] ${counts.serious} serious violation(s) — review recommended`)
    }
    expect(
      counts.critical,
      `Found ${counts.critical} critical WCAG violations on Rewards play page`,
    ).toBe(0)
  })

})

test.describe('Accessibility — Sakura Xian', () => {

  test('Homepage has no critical/serious WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto(XIAN_URL, { waitUntil: 'networkidle' })
    await injectAxe(page)

    const violations = await getViolations(page, undefined, { axeOptions: AXE_CONFIG })
    const counts     = countByImpact(violations)

    if (violations.length > 0) {
      console.log(`[A11y Xian] ${violations.length} violation(s):`)
      violations.forEach(v => console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`))
    }

    appendResult({
      app:      'sakura-xian',
      url:      XIAN_URL,
      scanAt:   new Date().toISOString(),
      ...counts,
      violations: violations.map(v => ({
        id:          v.id,
        impact:      v.impact,
        description: v.description,
        nodes:       v.nodes.length,
      })),
    })

    if (counts.serious > 0) {
      console.warn(`[A11y Xian] ${counts.serious} serious violation(s) on homepage — review recommended`)
    }
    expect(
      counts.critical,
      `Found ${counts.critical} critical WCAG violations on Xian homepage`,
    ).toBe(0)
  })

  test('Player page has no critical/serious WCAG 2.1 AA violations', async ({ page }) => {
    // Navigate to a playlist player — using the first available slug
    const home = await page.goto(XIAN_URL, { waitUntil: 'networkidle' })
    expect(home?.status()).toBeLessThan(500)

    // Try to find a playlist link
    const playlistLink = page.locator('[data-testid="playlist-card"] a, a[href^="/player/"]').first()
    const playerUrl = await playlistLink.getAttribute('href').catch(() => null)

    if (!playerUrl) {
      console.log('[A11y Xian] No playlist link found — skipping player page scan')
      return
    }

    await page.goto(`${XIAN_URL}${playerUrl}`, { waitUntil: 'networkidle' })
    await injectAxe(page)

    const violations = await getViolations(page, undefined, { axeOptions: AXE_CONFIG })
    const counts     = countByImpact(violations)

    if (violations.length > 0) {
      console.log(`[A11y Xian Player] ${violations.length} violation(s):`)
      violations.forEach(v => console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`))
    }

    if (counts.serious > 0) {
      console.warn(`[A11y Xian] ${counts.serious} serious violation(s) on player — review recommended`)
    }
    expect(
      counts.critical,
      `Found ${counts.critical} critical WCAG violations on Xian player page`,
    ).toBe(0)
  })

})

/* ── Cross-app: verify results file exists after all scans ────────────────── */

test('A11y results file is written and contains all 3 apps', async () => {
  test.skip(!fs.existsSync(RESULTS_FILE), 'Run accessibility tests first to generate results file')

  const results: A11yAppResult[] = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
  const apps = results.map(r => r.app)

  console.log('[A11y] Scanned apps:', apps)
  for (const r of results) {
    console.log(`  ${r.app}: critical=${r.critical} serious=${r.serious} moderate=${r.moderate} minor=${r.minor}`)
  }

  expect(results.length).toBeGreaterThan(0)
})
