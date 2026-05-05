/**
 * Sakura Shield — Base Page Object
 * FR: Classe de base pour tous les Page Objects de la suite Sakura Shield.
 *     Fournit les helpers de navigation, d'attente et d'assertion communs.
 * EN: Base class for all Sakura Shield Page Objects.
 *     Provides shared navigation, wait, and assertion helpers.
 */

import { Page } from '@playwright/test'

export abstract class BasePage {
  protected readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  /** Navigate to the page's canonical URL */
  abstract goto(): Promise<void>

  /**
   * Wait for DOM + network to settle.
   * FR: Attend que le DOM soit chargé et le réseau inactif.
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForLoadState('networkidle')
  }

  // ── Visibility helpers ─────────────────────────────────────────────────

  /**
   * Returns true if the locator is visible within the timeout.
   * FR: Retourne true si l'élément est visible dans le délai imparti.
   */
  async isVisible(selector: string, timeout = 5_000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout })
      return true
    } catch {
      return false
    }
  }

  /**
   * Wait for a selector to appear, then return its inner text.
   * FR: Attend l'apparition d'un sélecteur, puis retourne son texte.
   */
  async getText(selector: string): Promise<string> {
    await this.page.locator(selector).waitFor({ state: 'visible' })
    return this.page.locator(selector).innerText()
  }

  // ── Storage helpers ────────────────────────────────────────────────────

  /**
   * Read a localStorage key (returns null if missing).
   * FR: Lit une clé du localStorage (null si absente).
   */
  async getLocalStorage(key: string): Promise<string | null> {
    return this.page.evaluate((k) => localStorage.getItem(k), key)
  }

  /**
   * Parse a JSON localStorage entry.
   * FR: Désérialise une entrée JSON du localStorage.
   */
  async getLocalStorageJSON<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.getLocalStorage(key)
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  }

  // ── Debug helpers ──────────────────────────────────────────────────────

  async title(): Promise<string> {
    return this.page.title()
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path:     `test-results/screenshots/${name}.png`,
      fullPage: true,
    })
  }
}
