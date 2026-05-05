/**
 * Sakura Shield — The Accused Page Object
 * FR: POM pour "The Accused" — jeu narratif de tribunal (Skolvex).
 *     Couvre : sélection de cas, choix d'argument, Tension Gauge, verdict, Judge's File.
 * EN: POM for "The Accused" — narrative courtroom game (Skolvex).
 *     Covers: case selection, argument choice, Tension Gauge, verdict, Judge's File.
 */

import { type Page } from '@playwright/test'
import { BasePage } from './BasePage'

const BASE_URL = process.env.THE_ACCUSED_URL || 'http://localhost:3001'

// ── Typed localStorage state ───────────────────────────────────────────────

export interface GameSession {
  tension:       number
  currentRound:  number
  phase:         'intro' | 'argument' | 'verdict' | 'complete'
  choiceHistory: string[]
}

export interface ProgressState {
  completedCases:  string[]
  caseResults:     Record<string, 'acquitted' | 'convicted'>
  playerJudgments: number
}

// ── Page Object ────────────────────────────────────────────────────────────

export class TheAccusedPage extends BasePage {

  // ── Locators ─────────────────────────────────────────────────────────
  readonly caseCards     = () => this.page.locator('[data-testid="case-card"], .case-card, [class*="case"]')
  readonly startBtn      = () => this.page.locator('[data-testid="start-case"], button:has-text("Start"), button:has-text("Commencer")').first()
  readonly skipBtn       = () => this.page.locator('[data-testid="skip-intro"], button:has-text("Skip"), button:has-text("Passer")').first()
  readonly tensionBar    = () => this.page.locator('[data-testid="tension-gauge"], [class*="tension"], [aria-label*="tension" i]').first()
  readonly argA          = () => this.page.locator('[data-arg="A"], [data-testid="arg-a"]').first()
  readonly argB          = () => this.page.locator('[data-arg="B"], [data-testid="arg-b"]').first()
  readonly argC          = () => this.page.locator('[data-arg="C"], [data-testid="arg-c"]').first()
  readonly verdictBanner = () => this.page.locator('[data-testid="verdict"], .verdict-banner, [class*="verdict"]').first()
  readonly judgeFile     = () => this.page.locator('[data-testid="judge-file"], [class*="judgeFile"]').first()
  readonly nextRoundBtn  = () => this.page.locator('[data-testid="next-round"], button:has-text("Next"), button:has-text("Suivant")').first()

  constructor(page: Page) {
    super(page)
  }

  // ── Navigation ────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  async goToCase(caseId: string): Promise<void> {
    await this.page.goto(`${BASE_URL}/case/${caseId}`, { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  // ── Intro ─────────────────────────────────────────────────────────────

  /**
   * Skip intro screens if the skip button is present.
   * FR: Passe les écrans d'introduction si le bouton est disponible.
   */
  async skipIntro(): Promise<void> {
    const visible = await this.isVisible('[data-testid="skip-intro"], button:has-text("Skip")', 3_000)
    if (visible) {
      await this.skipBtn().click()
      await this.page.waitForTimeout(400)
    }
  }

  // ── Game state ────────────────────────────────────────────────────────

  /**
   * Read the current game session from localStorage.
   * FR: Lit la session de jeu courante depuis le localStorage.
   */
  async getSession(caseId: string): Promise<GameSession | null> {
    return this.getLocalStorageJSON<GameSession>(`the-accused-save-${caseId}`)
  }

  /**
   * Read the player's global progress from localStorage.
   * FR: Lit la progression globale du joueur depuis le localStorage.
   */
  async getProgress(): Promise<ProgressState | null> {
    return this.getLocalStorageJSON<ProgressState>('the-accused-progress')
  }

  /**
   * Read tension value from localStorage (most reliable source).
   * FR: Lit la valeur de tension depuis le localStorage (source la plus fiable).
   */
  async getTension(caseId: string): Promise<number | null> {
    const session = await this.getSession(caseId)
    return session?.tension ?? null
  }

  // ── Argument ──────────────────────────────────────────────────────────

  type ArgumentKey = 'A' | 'B' | 'C'

  /**
   * Choose an argument and wait for the game state to update.
   * FR: Choisit un argument et attend la mise à jour de l'état du jeu.
   */
  async chooseArgument(arg: 'A' | 'B' | 'C', caseId: string): Promise<{ before: number | null; after: number | null }> {
    const before = await this.getTension(caseId)
    const btn = arg === 'A' ? this.argA() : arg === 'B' ? this.argB() : this.argC()
    await btn.click()
    await this.page.waitForTimeout(800)
    const after = await this.getTension(caseId)
    return { before, after }
  }

  // ── Verdict ───────────────────────────────────────────────────────────

  /**
   * Wait for the verdict banner and return the outcome text.
   * FR: Attend l'affichage du verdict et retourne le texte du résultat.
   */
  async waitForVerdict(): Promise<string> {
    await this.verdictBanner().waitFor({ state: 'visible', timeout: 10_000 })
    return this.verdictBanner().innerText()
  }

  /**
   * Simulate a full case from start to verdict with predefined choices.
   * FR: Simule un cas complet du début au verdict avec des choix prédéfinis.
   */
  async playFullCase(
    caseId: string,
    choices: ('A' | 'B' | 'C')[],
  ): Promise<{ verdict: string; finalTension: number | null }> {
    await this.goToCase(caseId)
    await this.skipIntro()

    for (const choice of choices) {
      const visible = await this.isVisible(`[data-arg="${choice}"]`, 5_000)
      if (!visible) break
      await this.chooseArgument(choice, caseId)
      const hasNext = await this.isVisible('[data-testid="next-round"]', 2_000)
      if (hasNext) await this.nextRoundBtn().click()
    }

    const verdict      = await this.waitForVerdict()
    const finalTension = await this.getTension(caseId)
    return { verdict, finalTension }
  }
}
