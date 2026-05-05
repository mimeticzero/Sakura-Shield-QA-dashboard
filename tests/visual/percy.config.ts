/**
 * Sakura Shield — Percy Visual Testing Configuration
 * FR: Configuration pour les tests de régression visuelle Percy
 * EN: Percy visual regression testing configuration
 *
 * Usage:
 *   PERCY_TOKEN=<token> npm run test:visual
 *
 * All visual snapshots are captured within the Playwright E2E specs
 * via percySnapshot() calls at key UI states.
 */

export default {
  version:  2,
  snapshot: {
    // Wait for all network requests + fonts to settle
    percyCSS:  '',
    enableJavascript: true,
    widths:    [375, 768, 1280, 1440],
    minHeight: 900,
  },
  discovery: {
    allowedHostnames:   ['sakuranode.com', 'sakurarewards.com', 'sakurafidelity.com', 'sakuraxian.com', 'localhost'],
    disallowedHostnames: [],
    networkIdleTimeout: 100,
  },
}
