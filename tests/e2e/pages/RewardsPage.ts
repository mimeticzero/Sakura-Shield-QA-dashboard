/**
 * Sakura Shield — Sakura Rewards Page Object
 * FR: POM pour Sakura Rewards — roue fortune gamifiée pour avis Google.
 *     Couvre : lancement de spin, résultat, distribution statistique, état localStorage.
 * EN: POM for Sakura Rewards — gamified spin wheel for Google reviews.
 *     Covers: spin launch, result reading, statistical distribution, localStorage state.
 */

import { type Page, type APIRequestContext } from '@playwright/test'
import { BasePage } from './BasePage'

const BASE_URL = process.env.REWARDS_URL || 'https://sakurarewards.com'

// ── Typed API responses ───────────────────────────────────────────────────

export interface SpinResult {
  label:       string
  probability: number
  reward?:     string
}

export interface SpinApiResponse {
  result:     SpinResult
  token:      string
  timestamp:  string
}

export interface SpinReport {
  total:    number
  byLabel:  Record<string, number>
  rawSpins: SpinResult[]
}

// ── Page Object ───────────────────────────────────────────────────────────

export class RewardsPage extends BasePage {

  // ── Locators ─────────────────────────────────────────────────────────
  readonly spinBtn        = () => this.page.locator('[data-testid="spin-btn"], button:has-text("Spin"), button:has-text("Tourner")').first()
  readonly resultLabel    = () => this.page.locator('[data-testid="result-label"], .spin-result, [class*="result"]').first()
  readonly wheelContainer = () => this.page.locator('[data-testid="wheel"], canvas, [class*="wheel"]').first()
  readonly tokenInput     = () => this.page.locator('[data-testid="review-token"], input[name="token"]').first()

  constructor(page: Page, private readonly request: APIRequestContext) {
    super(page)
  }

  // ── Navigation ────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  // ── Spin via UI ───────────────────────────────────────────────────────

  /**
   * Trigger one spin and wait for the result to appear.
   * FR: Déclenche un spin et attend l'affichage du résultat.
   */
  async spin(): Promise<string> {
    await this.spinBtn().click()
    await this.page.waitForTimeout(2_500)   // animation
    return this.resultLabel().innerText()
  }

  // ── Spin via API ──────────────────────────────────────────────────────

  /**
   * POST /api/spin — returns the raw API response.
   * FR: Appelle POST /api/spin et retourne la réponse brute de l'API.
   */
  async spinViaApi(token: string): Promise<{ status: number; body: SpinApiResponse | null }> {
    const res = await this.request.post(`${BASE_URL}/api/spin`, {
      headers: { 'Content-Type': 'application/json' },
      data:    { token },
    })
    const body = res.ok() ? await res.json() as SpinApiResponse : null
    return { status: res.status(), body }
  }

  /**
   * GET /api/config — returns wheel configuration (labels + probabilities).
   * FR: Retourne la configuration de la roue (labels + probabilités).
   */
  async getConfig(): Promise<{ status: number; labels?: string[]; probabilities?: number[] }> {
    const res  = await this.request.get(`${BASE_URL}/api/config`)
    const body = res.ok() ? await res.json() as { labels: string[]; probabilities: number[] } : null
    return {
      status:        res.status(),
      labels:        body?.labels,
      probabilities: body?.probabilities,
    }
  }

  // ── Distribution helpers ──────────────────────────────────────────────

  /**
   * Load spin results from the persisted JSON report.
   * FR: Charge les résultats de spin depuis le rapport JSON persisté.
   */
  loadResultsFromFile(path: string): SpinReport {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    return JSON.parse(fs.readFileSync(path, 'utf8')) as SpinReport
  }

  /**
   * χ² goodness-of-fit test for spin distribution.
   * Returns { statistic, passed } — passes if χ² < critical value at α=0.05.
   *
   * FR: Test du χ² pour valider que la distribution des spins correspond
   *     aux probabilités configurées. Passe si χ² < valeur critique (α=0.05).
   */
  chiSquareTest(
    observed:  Record<string, number>,
    expected:  Record<string, number>,
    total:     number,
  ): { statistic: number; passed: boolean } {
    const CRITICAL_005 = 11.07    // χ² critical value, df=5, α=0.05
    let chi = 0
    for (const [label, prob] of Object.entries(expected)) {
      const exp = prob * total
      const obs = observed[label] ?? 0
      chi += ((obs - exp) ** 2) / exp
    }
    return { statistic: Math.round(chi * 100) / 100, passed: chi < CRITICAL_005 }
  }

  // ── localStorage ──────────────────────────────────────────────────────

  async getSpinState(): Promise<unknown> {
    return this.getLocalStorageJSON('sakura-rewards-state')
  }
}
