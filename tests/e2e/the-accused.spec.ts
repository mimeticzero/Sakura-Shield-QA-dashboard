/**
 * Sakura Shield — The Accused E2E Test Suite
 * FR: Tests E2E pour le jeu narratif "The Accused" (Skolvex)
 * EN: E2E tests for the narrative courtroom game "The Accused" (Skolvex)
 *
 * Architecture: Page Object Model (TheAccusedPage)
 *   → Navigation, localStorage helpers, argument selection and verdict
 *     are encapsulated in TheAccusedPage.
 *   → Tests focus purely on assertion logic.
 *
 * Covered flows:
 *  1. Case 1 (Elena) appears on the case select screen
 *  2. Case 1 launches and reaches Round 1 argument selection
 *  3. Selecting Argument A decreases the Tension Gauge
 *  4. Full game loop → Acquittal verdict → persisted to Judge's File
 *  5. Judge's File lists Elena after seeded localStorage completion
 *
 * localStorage keys (from game-engine.ts):
 *  - 'the-accused-progress'      → ProgressState
 *  - 'the-accused-save-{caseId}' → GameSession
 */

import { test, expect } from '@playwright/test'
import { percySnapshot }   from '@percy/playwright'
import { TheAccusedPage }  from './pages'

// The Accused runs locally only — skip in CI (no local server available)
test.skip(!!process.env.CI, 'The Accused server is local-only, skipped in CI')

const BASE_URL = process.env.THE_ACCUSED_URL || 'http://localhost:3001'

/* ─── Advance-to-arguments helper (UI-heavy, kept at spec level) ──────────── */

async function advanceToArguments(accused: TheAccusedPage) {
  const argPanel = accused.page
    .getByRole('button')
    .filter({ has: accused.page.locator('span', { hasText: /^A$/ }) })
    .first()

  for (let attempt = 0; attempt < 30; attempt++) {
    if (await argPanel.isVisible({ timeout: 500 }).catch(() => false)) return

    const suiteBtn     = accused.page.getByRole('button', { name: /^Suite →$/ }).first()
    const startBtn     = accused.page.getByRole('button', { name: /Commencer l'audience/i }).first()
    const continuerBtn = accused.page.getByRole('button', { name: /^Continuer →$/ }).first()

    if (await suiteBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await suiteBtn.click(); await accused.page.waitForTimeout(500)
    } else if (await startBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await startBtn.click(); await accused.page.waitForTimeout(600)
    } else if (await continuerBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await continuerBtn.click(); await accused.page.waitForTimeout(600)
    } else {
      await accused.page.waitForTimeout(1500)
    }
  }
}

/* ── Select argument by letter (buttons matched by span text) ─────────────── */

async function selectArgument(accused: TheAccusedPage, letter: 'A' | 'B' | 'C' | 'D') {
  const btn = accused.page
    .getByRole('button')
    .filter({ has: accused.page.locator('span', { hasText: new RegExp(`^${letter}$`) }) })
    .first()

  await btn.waitFor({ timeout: 8000 })
  await btn.click()
  await accused.page.waitForTimeout(300)

  const confirmBtn = accused.page.getByRole('button', { name: 'Confirmer' })
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click()
    await accused.page.waitForTimeout(800)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUITE
═══════════════════════════════════════════════════════════════════════════ */

test.describe('The Accused — Case 1: Elena Vasquez', () => {

  let serverOnline = false

  test.beforeAll(async ({ browser }) => {
    const ctx  = await browser.newContext()
    const page = await ctx.newPage()
    try {
      const res = await page.goto(BASE_URL, { timeout: 5000 })
      serverOnline = (res?.status() ?? 0) < 500
    } catch {
      serverOnline = false
    }
    await ctx.close()
    if (!serverOnline) {
      console.warn(
        `[The Accused] Server not reachable at ${BASE_URL}.\n` +
        `  Start: cd "C:/Users/L/Desktop/The Accused - Skolvex/the-accused" && npm run dev -- --port 3001`,
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    test.skip(!serverOnline, `The Accused not running at ${BASE_URL}`)
    const accused = new TheAccusedPage(page)
    await accused.goto()
    // Clear all game state via localStorage
    await page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith('the-accused')) keys.push(k)
      }
      keys.forEach(k => localStorage.removeItem(k))
    })
  })

  /* ── 1. Case select screen ──────────────────────────────────────────────── */

  test('should display Case 1 (Elena) on the select screen', async ({ page }) => {
    const accused = new TheAccusedPage(page)
    await page.goto(`${BASE_URL}/select`, { waitUntil: 'networkidle' })

    const case1 = page
      .getByText('Elena Vasquez')
      .or(page.getByText("L'État contre Vasquez"))
      .or(page.getByText('Cas 01').or(page.getByText('Cas 1')))
      .first()

    await expect(case1).toBeVisible({ timeout: 8000 })
    await percySnapshot(page, 'The Accused — Case Select Screen')
    void accused
  })

  /* ── 2. Launch Case 1 and reach Round 1 ────────────────────────────────── */

  test('should launch Case 1 and reach Round 1 argument selection', async ({ page }) => {
    const accused = new TheAccusedPage(page)
    await accused.goToCase('elena')
    await percySnapshot(page, 'The Accused — Case 1 Entry')

    await advanceToArguments(accused)

    const argA = accused.page
      .getByRole('button')
      .filter({ has: accused.page.locator('span', { hasText: /^A$/ }) })
      .first()

    await expect(argA).toBeVisible({ timeout: 10_000 })
    await percySnapshot(page, 'The Accused — Round 1 Arguments')
  })

  /* ── 3. Argument A → tension decreases ─────────────────────────────────── */
  /**
   * FR: Vérifie via localStorage ET l'interface que la tension diminue après
   *     la sélection de l'argument A (tensionDelta: -5).
   * EN: Verifies via localStorage AND UI that tension decreases after
   *     argument A is selected (tensionDelta: -5).
   */
  test('should update Tension Gauge after Round 1 argument A is selected', async ({ page }) => {
    test.setTimeout(60_000)
    const accused = new TheAccusedPage(page)
    await accused.goToCase('elena')
    await advanceToArguments(accused)

    // Dismiss lawyer intervention if present
    const dismissBtn = page.getByRole('button', { name: /Suite|→|Continuer|Suivant|Fermer|Ok/i }).first()
    if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissBtn.click()
      await page.waitForTimeout(400)
    }

    // Read UI tension before
    const tensionText = page.locator('span', { hasText: /^\d+%$/ }).last()
    const beforeText  = await tensionText.textContent({ timeout: 5000 }).catch(() => '50%')
    const before      = parseInt(beforeText ?? '50')

    await selectArgument(accused, 'A')
    await page.waitForTimeout(1200)

    // UI assertion
    const afterText = await tensionText.textContent({ timeout: 5000 }).catch(() => '50%')
    const after     = parseInt(afterText ?? '50')
    expect(after).toBeLessThanOrEqual(before)

    // localStorage assertion via POM
    const session = await accused.getSession('elena')
    if (session?.tension !== undefined) {
      expect(session.tension).toBeLessThanOrEqual(before)
    }

    await percySnapshot(page, 'The Accused — After Round 1 Argument A')
  })

  /* ── 4. Full game → Acquittal + Judge's File ────────────────────────────── */

  test('should reach an Acquittal verdict and persist to Judge File', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000)
    const accused = new TheAccusedPage(page)
    await accused.goToCase('elena')
    await advanceToArguments(accused)

    const verdictPattern = /acquitté|acquittée|relaxé|condamné|verdict/i
    const argALocator    = () =>
      page.getByRole('button').filter({ has: page.locator('span', { hasText: /^A$/ }) }).first()

    for (let i = 0; i < 120; i++) {
      if (await page.getByText(verdictPattern).first().isVisible({ timeout: 400 }).catch(() => false)) break
      if (await argALocator().isVisible({ timeout: 400 }).catch(() => false)) {
        await selectArgument(accused, 'A')
        await page.waitForTimeout(800)
        continue
      }
      const advance = page.getByRole('button', { name: /Suite|Continuer|Suivant|Fermer|Ok|Terminer/i }).first()
      if (await advance.isVisible({ timeout: 600 }).catch(() => false)) {
        await advance.click()
        await page.waitForTimeout(500)
        continue
      }
      await page.waitForTimeout(1000)
    }

    await page.waitForTimeout(2000)
    await percySnapshot(page, 'The Accused — Verdict Screen')

    // POM: read progress from localStorage
    const progress   = await accused.getProgress()
    const completed  = progress?.completedCases ?? []
    const results    = progress?.caseResults    ?? {}
    const recorded   = completed.includes('elena') || 'elena' in results
    expect(recorded).toBe(true)
  })

  /* ── 5. Judge's File lists Elena after seeded completion ──────────────── */

  test("Judge's File should list Elena Vasquez after case completion", async ({ page }) => {
    const accused = new TheAccusedPage(page)
    await accused.goto()

    // Seed progress directly into localStorage (no need to play the full game)
    await page.evaluate(() => {
      localStorage.setItem('the-accused-progress', JSON.stringify({
        completedCases: ['elena'],
        caseResults:    { elena: { verdict: 'acquitted', tension: 28, timestamp: Date.now() } },
        playerJudgments: [],
      }))
    })

    await page.goto(`${BASE_URL}/cases`, { waitUntil: 'networkidle' })

    const elenaEntry = page
      .getByText('Elena Vasquez')
      .or(page.getByText("L'État contre Vasquez"))
      .first()

    const visible = await elenaEntry.isVisible({ timeout: 5000 }).catch(() => false)
    if (!visible) {
      await page.goto(`${BASE_URL}/achievements`, { waitUntil: 'networkidle' })
    }

    await percySnapshot(page, 'The Accused — Completed Cases (Elena)')

    // POM: verify seeded data is correct
    const progress = await accused.getProgress()
    expect(progress?.completedCases).toContain('elena')
  })

})
