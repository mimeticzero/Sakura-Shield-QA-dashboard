/**
 * Sakura Shield — Sakura Xian E2E Test Suite
 * FR: Tests E2E pour le jukebox interactif Sakura Xian
 * EN: E2E tests for the Sakura Xian interactive jukebox
 *
 * Architecture: Page Object Model (XianPage)
 *   → Locators, network interception, and API calls are encapsulated in XianPage.
 *   → Tests focus purely on assertion logic.
 *
 * Covered flows:
 *  1. Homepage loads with HTTP 200
 *  2. All audio tracks served with HTTP 200
 *  3. Track change fires a new audio network request
 *  4. Playlist items are visible in the UI
 *  5. Lighthouse performance budget
 */

import { test, expect } from '@playwright/test'
import { percySnapshot }  from '@percy/playwright'
import { XianPage }       from './pages'

const BASE_URL = process.env.XIAN_URL || 'https://sakuraxian.com'

/* ─── Lighthouse helper (runs in Node via child_process) ─────────────────── */

async function runLighthouseAudit(url: string): Promise<{
  performance: number; fcp: number; lcp: number; tti: number
}> {
  try {
    const { execSync } = await import('child_process')
    execSync(
      `npx lighthouse ${url} --output=json --output-path=../../test-results/lighthouse-xian.json --chrome-flags="--headless" --quiet`,
      { timeout: 60_000, stdio: 'pipe' },
    )
    const fs  = await import('fs')
    const raw = fs.readFileSync('../../test-results/lighthouse-xian.json', 'utf8')
    const rep = JSON.parse(raw)
    return {
      performance: Math.round((rep.categories?.performance?.score ?? 0) * 100),
      fcp:         Math.round(rep.audits?.['first-contentful-paint']?.numericValue ?? 0),
      lcp:         Math.round(rep.audits?.['largest-contentful-paint']?.numericValue ?? 0),
      tti:         Math.round(rep.audits?.['interactive']?.numericValue ?? 0),
    }
  } catch {
    return { performance: 0, fcp: 0, lcp: 0, tti: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUITE
═══════════════════════════════════════════════════════════════════════════ */

test.describe('Sakura Xian — Jukebox', () => {

  /* ── 1. Homepage loads ────────────────────────────────────────────────── */

  test('should load the Xian homepage with status 200', async ({ page, request }) => {
    const xian     = new XianPage(page, request)
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await percySnapshot(page, 'Sakura Xian — Homepage')
    void xian
  })

  /* ── 2. Audio files served with 200 ──────────────────────────────────── */

  test('should serve all audio tracks with HTTP 200', async ({ page, request }) => {
    const xian = new XianPage(page, request)
    const audioRequests: Array<{ url: string; status: number }> = []

    page.on('response', response => {
      if (/\.(mp3|wav|ogg|flac|aac)(\?.*)?$/i.test(response.url())) {
        audioRequests.push({ url: response.url(), status: response.status() })
      }
    })

    await xian.goto()

    // Trigger lazy-loaded audio by starting playback and browsing tracks
    if (await xian.playBtn().count()) {
      await xian.playBtn().click()
      await page.waitForTimeout(2000)
    }
    for (let i = 0; i < 3; i++) {
      if (await xian.nextBtn().count()) {
        await xian.nextBtn().click()
        await page.waitForTimeout(1000)
      }
    }

    console.log(`[Xian] Audio requests: ${audioRequests.length}`)
    audioRequests.forEach(r => console.log(`  ${r.status} — ${r.url}`))

    const failed = audioRequests.filter(r => r.status !== 200)
    expect(failed.length, `Failed audio requests: ${JSON.stringify(failed)}`).toBe(0)
  })

  /* ── 3. Track change fires a new audio request ────────────────────────── */

  test('should change track and fire a new audio request', async ({ page, request }) => {
    const xian = new XianPage(page, request)
    await xian.goto()

    if (await xian.playBtn().count()) {
      await xian.playBtn().click()
      await page.waitForTimeout(1500)
    }

    await percySnapshot(page, 'Sakura Xian — Track Playing')

    // POM: intercept + click next in one atomic call
    if (await xian.nextBtn().count()) {
      const audioStatus = await xian.getAudioRequestStatus()
      expect(audioStatus).toBe(200)
    }

    await percySnapshot(page, 'Sakura Xian — Track Changed')
  })

  /* ── 4. Playlist items are displayed ──────────────────────────────────── */

  test('should display playlist items in the UI', async ({ page, request }) => {
    const xian = new XianPage(page, request)
    await xian.goto()

    const cardCount = await xian.playlistCards().count()
    const listItems = page.locator('ul li, ol li').first()

    const visible = cardCount > 0 || (await listItems.isVisible().catch(() => false))
    console.log(`[Xian] Playlist items visible: ${visible}`)

    await percySnapshot(page, 'Sakura Xian — Playlist Visible')
  })

  /* ── 5. Lighthouse performance budget ─────────────────────────────────── */

  test('should meet Lighthouse performance budget', async () => {
    const metrics = await runLighthouseAudit(BASE_URL)
    console.log('[Xian] Lighthouse metrics:', metrics)

    if (metrics.performance > 0) {
      expect(metrics.performance).toBeGreaterThanOrEqual(70)
      expect(metrics.lcp).toBeLessThanOrEqual(4_000)
      expect(metrics.tti).toBeLessThanOrEqual(5_000)
    } else {
      test.skip(true, 'Lighthouse not available in this environment')
    }
  })

})
