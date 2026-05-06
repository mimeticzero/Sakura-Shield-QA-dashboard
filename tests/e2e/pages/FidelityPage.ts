/**
 * Sakura Shield — Sakura Fidelity Page Object
 * FR: POM pour Sakura Fidelity — gestion des cartes de fidélité B2B.
 *     Couvre : authentification, lecture de solde, rachat de récompense (succès + garde 403).
 * EN: POM for Sakura Fidelity — B2B loyalty card management.
 *     Covers: authentication, balance reading, reward redemption (success + 403 guard).
 */

import { type Page, type APIRequestContext } from '@playwright/test'
import { BasePage } from './BasePage'

const BASE_URL = process.env.FIDELITY_URL || 'https://sakurafidelity.com'

// ── Typed API responses ───────────────────────────────────────────────────

export interface BalanceResponse {
  email:  string
  points: number
}

export interface RedeemResponse {
  success: boolean
  points:  number
  message?: string
}

export interface RedeemResult {
  httpStatus:    number
  balanceBefore: number
  balanceAfter:  number
}

// ── Page Object ───────────────────────────────────────────────────────────

export class FidelityPage extends BasePage {

  // ── Locators ─────────────────────────────────────────────────────────
  readonly emailInput    = () => this.page.locator('[data-testid="email"], input[type="email"]').first()
  readonly passwordInput = () => this.page.locator('[data-testid="password"], input[type="password"]').first()
  readonly loginBtn      = () => this.page.locator('[data-testid="login-btn"], button[type="submit"]').first()
  readonly balanceEl     = () => this.page.locator('[data-testid="balance"], .balance-value, [class*="balance"]').first()
  readonly redeemInput   = () => this.page.locator('[data-testid="redeem-points"], input[name="points"]').first()
  readonly redeemBtn     = () => this.page.locator('[data-testid="redeem-btn"], button:has-text("Redeem"), button:has-text("Racheter")').first()
  readonly errorEl       = () => this.page.locator('[data-testid="error"], [role="alert"], .error-message').first()
  readonly successEl     = () => this.page.locator('[data-testid="success"], .success-message').first()

  constructor(page: Page, private readonly request: APIRequestContext) {
    super(page)
  }

  // ── Navigation ────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  /**
   * Log in with email + password via the UI form.
   * FR: Connexion via le formulaire UI.
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email)
    await this.passwordInput().fill(password)
    await this.loginBtn().click()
    await this.waitForReady()
  }

  // ── Balance ───────────────────────────────────────────────────────────

  /**
   * Read the displayed balance from the DOM.
   * FR: Lit le solde affiché dans le DOM.
   */
  async getDisplayedBalance(): Promise<number> {
    const text = await this.balanceEl().innerText()
    return parseInt(text.replace(/\D/g, ''), 10) || 0
  }

  /**
   * Fetch balance directly from the REST API (no browser rendering).
   * FR: Récupère le solde directement via l'API REST (sans rendu navigateur).
   */
  async getApiBalance(email: string): Promise<number> {
    const res  = await this.request.get(`${BASE_URL}/api/balance`, { params: { email } })
    const body = await res.json().catch(() => ({})) as BalanceResponse
    return body.points ?? 0
  }

  // ── Redemption ────────────────────────────────────────────────────────

  /**
   * Attempt redemption via the API and return full audit data.
   * Captures balance before and after to assert atomicity.
   *
   * FR: Tente un rachat via l'API et retourne les données d'audit complètes.
   *     Capture le solde avant/après pour vérifier l'atomicité.
   */
  async redeemViaApi(email: string, points: number): Promise<RedeemResult> {
    const balanceBefore = await this.getApiBalance(email)

    const res = await this.request.post(`${BASE_URL}/api/redeem`, {
      headers: { 'Content-Type': 'application/json' },
      data:    { email, points },
    })

    const balanceAfter = await this.getApiBalance(email)

    return {
      httpStatus:    res.status(),
      balanceBefore,
      balanceAfter,
    }
  }

  /**
   * Redeem via the UI form (end-to-end user path).
   * FR: Rachat via le formulaire UI (chemin utilisateur de bout en bout).
   */
  async redeemViaUi(points: number): Promise<void> {
    await this.redeemInput().fill(String(points))
    await this.redeemBtn().click()
    await this.page.waitForTimeout(500)
  }

  // ── State assertions ──────────────────────────────────────────────────

  async hasError(): Promise<boolean>   { return this.isVisible('[data-testid="error"], [role="alert"], .error-message') }
  async hasSuccess(): Promise<boolean> { return this.isVisible('[data-testid="success"], .success-message') }
}
