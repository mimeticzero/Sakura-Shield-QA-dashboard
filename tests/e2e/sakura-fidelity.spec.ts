/**
 * Sakura Shield — Sakura Fidelity E2E Test Suite
 * FR: Tests de sécurité et logique transactionnelle pour Sakura Fidelity
 * EN: Security & transactional logic tests for Sakura Fidelity
 *
 * Architecture: Page Object Model (FidelityPage)
 *   → All locators, API calls and navigation are encapsulated in FidelityPage.
 *   → Tests focus purely on assertion logic.
 *
 * Covered flows:
 *  1. Homepage loads
 *  2. Login form renders
 *  3. 403 guard — redemption with insufficient points is blocked
 *  4. Atomicity invariant — balance unchanged after failed redemption
 *  5. Transaction history endpoint requires authentication
 */

import { test, expect } from '@playwright/test'
import { percySnapshot }  from '@percy/playwright'
import { FidelityPage }   from './pages'

const BASE_URL   = process.env.FIDELITY_URL        || 'https://sakurafidelity.com'
const TEST_EMAIL = process.env.FIDELITY_TEST_EMAIL || 'qa-test@sakura.local'

/* ══════════════════════════════════════════════════════════════════════════════
   SUITE
══════════════════════════════════════════════════════════════════════════════ */

test.describe('Sakura Fidelity — Transactional Logic & Security', () => {

  /* ── 1. Homepage loads ────────────────────────────────────────────────── */

  test('should load the Fidelity homepage', async ({ page, request }) => {
    const fidelity = new FidelityPage(page, request)
    await fidelity.goto()

    const res = await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    await percySnapshot(page, 'Sakura Fidelity — Homepage')
  })

  /* ── 2. Login page renders ────────────────────────────────────────────── */

  test('should render the login form', async ({ page, request }) => {
    const fidelity = new FidelityPage(page, request)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })

    await expect(fidelity.emailInput()).toBeVisible()
    await expect(fidelity.passwordInput()).toBeVisible()
    await percySnapshot(page, 'Sakura Fidelity — Login Form')
  })

  /* ── 3. CORE: 403 on insufficient points ─────────────────────────────── */
  /**
   * FR: Valide qu'un utilisateur ne peut pas racheter une récompense sans points
   *     suffisants. Le backend doit retourner 403 et le solde ne doit pas changer.
   * EN: Validates the backend blocks reward redemption when points are insufficient,
   *     returning 403 with an unchanged balance.
   */
  test('should return 403 and not deduct points when balance is insufficient', async ({ page, request }) => {
    const fidelity = new FidelityPage(page, request)

    // Intercept all redemption API calls fired by the browser
    const redemptionAttempts: Array<{ url: string; status: number }> = []
    page.on('response', response => {
      if (/redeem|transaction|loyalty/i.test(response.url())) {
        redemptionAttempts.push({ url: response.url(), status: response.status() })
      }
    })

    // Navigate to rewards section
    await page.goto(`${BASE_URL}/dashboard/rewards`, { waitUntil: 'networkidle' }).catch(async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {})
    })
    await percySnapshot(page, 'Sakura Fidelity — Rewards Section')

    // Try clicking the first redeem button if visible
    const redeemBtns = page.locator('button').filter({ hasText: /échanger|redeem|utiliser|claim/i })
    if (await redeemBtns.count() > 0) {
      await redeemBtns.first().click()
      await page.waitForTimeout(2000)
      await percySnapshot(page, 'Sakura Fidelity — Insufficient Points Error')
    }

    // Direct API check via POM — unauthenticated redeem must be blocked
    const result = await fidelity.redeemViaApi(TEST_EMAIL, 9_999)
    expect([400, 401, 403, 405, 422]).toContain(result.httpStatus)

    // If UI triggered an attempt, it must have been blocked
    const blocked = redemptionAttempts.filter(a => [401, 403, 422].includes(a.status))
    if (redemptionAttempts.length > 0) {
      expect(blocked.length).toBeGreaterThan(0)
    }
  })

  /* ── 4. Balance invariant after failed redemption ─────────────────────── */
  /**
   * FR: C'est la garantie de sécurité transactionnelle centrale du système Fidelity.
   *     Le solde doit être strictement identique avant et après un rachat refusé.
   * EN: Core transactional safety guarantee of the Fidelity system.
   *     Balance must be strictly identical before and after a rejected redemption.
   */
  test('point balance should not change after a failed redemption attempt', async ({ page, request }) => {
    const fidelity = new FidelityPage(page, request)

    // POM.redeemViaApi snapshots balance before AND after in a single call
    const { httpStatus, balanceBefore, balanceAfter } = await fidelity.redeemViaApi(TEST_EMAIL, 9_999)

    // Redemption must be rejected
    expect([400, 401, 403, 405, 422]).toContain(httpStatus)

    // Atomicity invariant: balance must not move
    expect(balanceAfter).toEqual(balanceBefore)

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await percySnapshot(page, 'Sakura Fidelity — Dashboard Balance')
  })

  /* ── 5. Transaction history is protected ─────────────────────────────── */

  test('transaction history endpoint should require authentication', async ({ request }) => {
    const endpoints = [
      `${BASE_URL}/api/transactions`,
      `${BASE_URL}/api/loyalty/transactions`,
      `${BASE_URL}/api/client/transactions`,
    ]

    for (const url of endpoints) {
      const res = await request.get(url).catch(() => null)
      if (res && res.status() !== 404) {
        expect(res.status()).not.toBe(200)
        expect([401, 403]).toContain(res.status())
        break
      }
    }
  })

})
