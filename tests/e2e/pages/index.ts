/**
 * Sakura Shield — Page Objects barrel export
 * FR: Export centralisé de tous les Page Objects de la suite.
 * EN: Centralised export for all suite Page Objects.
 *
 * Usage:
 *   import { FidelityPage, RewardsPage, XianPage, TheAccusedPage } from '../pages'
 */

export { BasePage }          from './BasePage'
export { FidelityPage }      from './FidelityPage'
export { RewardsPage }       from './RewardsPage'
export { XianPage }          from './XianPage'
export { TheAccusedPage }    from './TheAccusedPage'

export type { BalanceResponse, RedeemResponse, RedeemResult } from './FidelityPage'
export type { SpinResult, SpinApiResponse, SpinReport }       from './RewardsPage'
export type { TrackInfo, PlaylistInfo }                        from './XianPage'
export type { GameSession, ProgressState }                     from './TheAccusedPage'
