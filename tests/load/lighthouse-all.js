/**
 * Sakura Shield — Lighthouse Audit: All Projects
 * FR: Audit Lighthouse sur les 4 apps Sakura — écrit lighthouse-projects.json
 * EN: Lighthouse audit across all 4 Sakura apps — writes lighthouse-projects.json
 *
 * Output: test-results/lighthouse-projects.json
 *   { "sakura-node": { performance, accessibility, seo, bestPractices, fcp, lcp, tti, ranAt, simulated: false }, ... }
 *
 * Usage:
 *   node tests/load/lighthouse-all.js
 *   XIAN_URL=https://sakuraxian.com node tests/load/lighthouse-all.js
 */

'use strict'

const lighthouse     = require('lighthouse')
const chromeLauncher = require('chrome-launcher')
const fs             = require('fs')
const path           = require('path')

const TARGETS = [
  { key: 'sakura-node',     url: process.env.SAKURA_NODE_URL || 'https://sakuranode.com'     },
  { key: 'sakura-fidelity', url: process.env.FIDELITY_URL    || 'https://sakurafidelity.com' },
  { key: 'sakura-rewards',  url: process.env.REWARDS_URL     || 'https://sakurarewards.com'  },
  { key: 'sakura-xian',     url: process.env.XIAN_URL        || 'https://sakuraxian.com'     },
]

const RESULTS_DIR    = path.resolve(__dirname, '../../test-results')
const PROJECTS_PATH  = path.join(RESULTS_DIR, 'lighthouse-projects.json')

const LH_FLAGS = {
  logLevel:       'error',
  output:         'json',
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  formFactor:     'desktop',
  screenEmulation: {
    mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false,
  },
  throttlingMethod: 'simulate',
  throttling: {
    rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1,
  },
}

function extract(lhr) {
  return {
    performance:   Math.round((lhr.categories?.performance?.score    ?? 0) * 100),
    accessibility: Math.round((lhr.categories?.accessibility?.score  ?? 0) * 100),
    seo:           Math.round((lhr.categories?.seo?.score            ?? 0) * 100),
    bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
    fcp:           Math.round(lhr.audits?.['first-contentful-paint']?.numericValue ?? 0),
    lcp:           Math.round(lhr.audits?.['largest-contentful-paint']?.numericValue ?? 0),
    tti:           Math.round(lhr.audits?.['interactive']?.numericValue ?? 0),
    ranAt:         lhr.fetchTime ?? new Date().toISOString(),
    simulated:     false,
  }
}

async function audit(url, port) {
  try {
    const result = await lighthouse(url, { ...LH_FLAGS, port })
    return extract(result.lhr)
  } catch (err) {
    console.error(`  ✗ Failed to audit ${url}: ${err.message}`)
    return null
  }
}

async function run() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })

  // Load existing data so a partial run doesn't wipe previous results
  const existing = fs.existsSync(PROJECTS_PATH)
    ? JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'))
    : {}

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  })

  console.log(`\n[Lighthouse] Chrome on port ${chrome.port}\n`)

  for (const { key, url } of TARGETS) {
    console.log(`[Lighthouse] Auditing ${key}: ${url}`)
    const scores = await audit(url, chrome.port)

    if (scores) {
      existing[key] = scores
      console.log(
        `  ✓ perf=${scores.performance} a11y=${scores.accessibility} ` +
        `seo=${scores.seo} bp=${scores.bestPractices} ` +
        `fcp=${scores.fcp}ms lcp=${scores.lcp}ms tti=${scores.tti}ms`
      )
    }

    // Brief pause between audits
    await new Promise(r => setTimeout(r, 2000))
  }

  await chrome.kill()

  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(existing, null, 2))
  console.log(`\n[Lighthouse] Results written to ${PROJECTS_PATH}\n`)
}

run().catch(err => {
  console.error('[Lighthouse] Fatal:', err.message)
  process.exit(1)
})
