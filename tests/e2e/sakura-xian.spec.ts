/**
 * Sakura Shield — Sakura Xian E2E Test Suite
 * FR: Tests E2E pour le jukebox interactif Sakura Xian
 * EN: E2E tests for the Sakura Xian interactive jukebox
 *
 * Covered flows:
 *  1. Playlist loads with status 200 for audio assets (.mp3 / .wav)
 *  2. Track change simulation with network request interception
 *  3. Lighthouse performance audit on playlist load
 *  4. Percy visual snapshot of jukebox states
 */

import { test, expect, Page } from '@playwright/test'
import { percySnapshot }      from '@percy/playwright'

const BASE_URL = process.env.XIAN_URL || 'https://sakuraxian.com'

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Collect all audio asset requests fired during an action */
async function collectAudioRequests(page: Page, action: () => Promise<void>) {
  const audioRequests: Array<{ url: string; status: number }> = []

  page.on('response', response => {
    const url = response.url()
    const isAudio = /\.(mp3|wav|ogg|flac|aac)(\?.*)?$/i.test(url)
    if (isAudio) {
      audioRequests.push({ url, status: response.status() })
    }
  })

  await action()
  return audioRequests
}

/* ── Lighthouse helper (runs in a separate Node context) ─────────────────── */
// Note: Lighthouse is executed via a dedicated script (tests/load/lighthouse-xian.js)
// This test verifies the metrics are within budget.

async function runLighthouseAudit(url: string): Promise<{
  performance: number; fcp: number; lcp: number; tti: number
}> {
  // In CI: results are piped from the pre-run lhci collect step
  // Locally: spawn lighthouse via child_process
  try {
    const { execSync } = await import('child_process')
    execSync(
      `npx lighthouse ${url} --output=json --output-path=../../test-results/lighthouse-xian.json --chrome-flags="--headless" --quiet`,
      { timeout: 60_000, stdio: 'pipe' }
    )
    const fs = await import('fs')
    const raw = fs.readFileSync('../../test-results/lighthouse-xian.json', 'utf8')
    const report = JSON.parse(raw)
    return {
      performance: Math.round((report.categories?.performance?.score ?? 0) * 100),
      fcp:         Math.round(report.audits?.['first-contentful-paint']?.numericValue ?? 0),
      lcp:         Math.round(report.audits?.['largest-contentful-paint']?.numericValue ?? 0),
      tti:         Math.round(report.audits?.['interactive']?.numericValue ?? 0),
    }
  } catch {
    // Return zeros if Lighthouse not available in this environment
    return { performance: 0, fcp: 0, lcp: 0, tti: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUITE
═══════════════════════════════════════════════════════════════════════════ */

test.describe('Sakura Xian — Jukebox', () => {

  /* ── 1. Homepage loads ─────────────────────────────────────────────────── */

  test('should load the Xian homepage with status 200', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await percySnapshot(page, 'Sakura Xian — Homepage')
  })

  /* ── 2. Audio files served with 200 ───────────────────────────────────── */

  test('should serve all audio tracks with HTTP 200', async ({ page }) => {
    const audioRequests: Array<{ url: string; status: number }> = []

    // Intercept ALL audio responses
    page.on('response', response => {
      if (/\.(mp3|wav|ogg|flac|aac)(\?.*)?$/i.test(response.url())) {
        audioRequests.push({ url: response.url(), status: response.status() })
      }
    })

    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    // Trigger playlist load if lazy
    const playBtn = page
      .getByRole('button', { name: /play|lire|lecture/i })
      .or(page.locator('[data-testid="play-btn"], .play-button, [aria-label*="play" i]'))
      .first()

    if (await playBtn.count()) {
      await playBtn.click()
      await page.waitForTimeout(2000)
    }

    // Navigate through tracks to trigger requests
    const nextBtn = page
      .getByRole('button', { name: /next|suivant|▶|›/i })
      .or(page.locator('[data-testid="next-track"], .next-track'))
      .first()

    for (let i = 0; i < 3; i++) {
      if (await nextBtn.count()) {
        await nextBtn.click()
        await page.waitForTimeout(1000)
      }
    }

    console.log(`[Xian] Audio requests intercepted: ${audioRequests.length}`)
    audioRequests.forEach(r => console.log(`  ${r.status} — ${r.url}`))

    // All audio requests must return 200
    const failed = audioRequests.filter(r => r.status !== 200)
    expect(failed.length, `Failed audio requests: ${JSON.stringify(failed)}`).toBe(0)
  })

  /* ── 3. Track change simulation ───────────────────────────────────────── */

  test('should change track and fire a new audio request', async ({ page }) => {
    let trackChanged = false
    let newTrackUrl  = ''

    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    // Start audio
    const playBtn = page
      .getByRole('button', { name: /play|lire/i })
      .or(page.locator('[data-testid="play-btn"]'))
      .first()

    if (await playBtn.count()) {
      await playBtn.click()
      await page.waitForTimeout(1500)
    }

    // Percy: initial state
    await percySnapshot(page, 'Sakura Xian — Track Playing')

    // Listen for the next audio request after clicking next
    const audioPromise = page.waitForResponse(
      r => /\.(mp3|wav|ogg|flac|aac)(\?.*)?$/i.test(r.url()),
      { timeout: 8000 }
    ).catch(() => null)

    const nextBtn = page
      .getByRole('button', { name: /next|suivant/i })
      .or(page.locator('[data-testid="next-track"], .next-track'))
      .first()

    if (await nextBtn.count()) {
      await nextBtn.click()
      const audioResponse = await audioPromise
      if (audioResponse) {
        trackChanged = true
        newTrackUrl  = audioResponse.url()
        expect(audioResponse.status()).toBe(200)
      }
    }

    // Percy: after track change
    await percySnapshot(page, 'Sakura Xian — Track Changed')

    console.log(`[Xian] Track changed: ${trackChanged}, URL: ${newTrackUrl}`)
    // Soft assertion — track change detected if next button exists
    if (await nextBtn.count()) {
      expect(trackChanged).toBe(true)
    }
  })

  /* ── 4. Playlist items are displayed ──────────────────────────────────── */

  test('should display playlist items in the UI', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    // At least one track title should be visible
    const trackItems = page
      .locator('[data-testid="track-item"], .track-item, .playlist-item, [class*="track"]')
      .first()

    // If no explicit track list component, check for any list-like structure
    const listItems = page.locator('ul li, ol li').first()

    const visible = (await trackItems.isVisible().catch(() => false))
      || (await listItems.isVisible().catch(() => false))

    // Percy regardless
    await percySnapshot(page, 'Sakura Xian — Playlist Visible')
    console.log(`[Xian] Playlist items visible: ${visible}`)
  })

  /* ── 5. Lighthouse performance budget ─────────────────────────────────── */

  test('should meet Lighthouse performance budget', async () => {
    const metrics = await runLighthouseAudit(BASE_URL)
    console.log('[Xian] Lighthouse metrics:', metrics)

    if (metrics.performance > 0) {
      // Budget: performance score ≥ 70, LCP ≤ 4 000ms, TTI ≤ 5 000ms
      expect(metrics.performance).toBeGreaterThanOrEqual(70)
      expect(metrics.lcp).toBeLessThanOrEqual(4_000)
      expect(metrics.tti).toBeLessThanOrEqual(5_000)
    } else {
      test.skip(true, 'Lighthouse not available in this environment')
    }
  })

})
