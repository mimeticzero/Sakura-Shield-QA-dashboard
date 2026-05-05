/**
 * Sakura Shield — Sakura Xian Page Object
 * FR: POM pour Sakura Xian — jukebox cyberpunk avec playlists curatées.
 *     Couvre : changement de piste, validation réseau (mp3 200), état lecture.
 * EN: POM for Sakura Xian — cyberpunk jukebox with curated playlists.
 *     Covers: track switching, network validation (mp3 200), playback state.
 */

import { type Page, type APIRequestContext, type Request } from '@playwright/test'
import { BasePage } from './BasePage'

const BASE_URL = process.env.XIAN_URL || 'https://sakuraxian.com'

// ── Typed responses ────────────────────────────────────────────────────────

export interface TrackInfo {
  title:    string
  artist:   string
  src:      string
  duration?: number
}

export interface PlaylistInfo {
  id:     string
  name:   string
  tracks: TrackInfo[]
}

// ── Page Object ────────────────────────────────────────────────────────────

export class XianPage extends BasePage {

  // ── Locators ─────────────────────────────────────────────────────────
  readonly playBtn       = () => this.page.locator('[data-testid="play-btn"], button[aria-label*="play" i], button[aria-label*="lecture" i]').first()
  readonly nextBtn       = () => this.page.locator('[data-testid="next-btn"], button[aria-label*="next" i], button[aria-label*="suivant" i]').first()
  readonly trackTitle    = () => this.page.locator('[data-testid="track-title"], .track-title, [class*="trackName"]').first()
  readonly trackArtist   = () => this.page.locator('[data-testid="track-artist"], .track-artist, [class*="artist"]').first()
  readonly audioElement  = () => this.page.locator('audio').first()
  readonly playlistCards = () => this.page.locator('[data-testid="playlist-card"], .playlist-card, [class*="playlist"]')

  constructor(page: Page, private readonly request: APIRequestContext) {
    super(page)
  }

  // ── Navigation ────────────────────────────────────────────────────────

  override async goto(): Promise<void> {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await this.waitForReady()
  }

  // ── Playback ──────────────────────────────────────────────────────────

  async getCurrentTrackTitle(): Promise<string> {
    return this.getText('[data-testid="track-title"], .track-title, [class*="trackName"]')
  }

  async clickNext(): Promise<string> {
    const before = await this.getCurrentTrackTitle()
    await this.nextBtn().click()
    await this.page.waitForFunction(
      (prev: string) => {
        const el = document.querySelector('[data-testid="track-title"], .track-title')
        return el && el.textContent !== prev
      },
      before,
      { timeout: 5_000 },
    )
    return this.getCurrentTrackTitle()
  }

  /**
   * Intercept the next audio network request and return its HTTP status.
   * FR: Intercepte la prochaine requête audio et retourne son statut HTTP.
   * This confirms the mp3/audio file actually resolves with 200.
   */
  async getAudioRequestStatus(): Promise<number> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res: Request | ReturnType<typeof this.page.waitForResponse> extends Promise<infer R> ? R : never) =>
          typeof res === 'object' && 'url' in res &&
          (String((res as { url(): string }).url()).includes('.mp3') ||
           String((res as { url(): string }).url()).includes('/audio/') ||
           String((res as { url(): string }).url()).includes('stream')),
        { timeout: 8_000 },
      ),
      this.nextBtn().click(),
    ])
    return (response as unknown as { status(): number }).status()
  }

  // ── API ───────────────────────────────────────────────────────────────

  /**
   * GET /api/playlists — returns available playlists.
   * FR: Retourne les playlists disponibles via l'API.
   */
  async getPlaylists(): Promise<{ status: number; playlists: PlaylistInfo[] }> {
    const res  = await this.request.get(`${BASE_URL}/api/playlists`)
    const body = res.ok() ? await res.json() as PlaylistInfo[] : []
    return { status: res.status(), playlists: body }
  }

  /**
   * GET /api/playlists/:id — returns a single playlist with tracks.
   * FR: Retourne une playlist avec ses pistes via l'API.
   */
  async getPlaylist(id: string): Promise<{ status: number; playlist: PlaylistInfo | null }> {
    const res     = await this.request.get(`${BASE_URL}/api/playlists/${id}`)
    const playlist = res.ok() ? await res.json() as PlaylistInfo : null
    return { status: res.status(), playlist }
  }

  // ── Audio state ───────────────────────────────────────────────────────

  /**
   * Returns true if the <audio> element is currently playing.
   * FR: Retourne true si l'élément <audio> est en cours de lecture.
   */
  async isPlaying(): Promise<boolean> {
    return this.page.evaluate(() => {
      const audio = document.querySelector('audio')
      return audio ? !audio.paused : false
    })
  }
}
