/**
 * Sakura Shield — Lighthouse Audit: Sakura Xian
 * FR: Audit de performance Lighthouse pour Sakura Xian
 * EN: Lighthouse performance audit for Sakura Xian jukebox
 *
 * Usage: node tests/load/lighthouse-xian.js [url]
 *
 * Budgets:
 *   Performance score  ≥ 70
 *   FCP                ≤ 2 500ms
 *   LCP                ≤ 4 000ms
 *   TTI                ≤ 5 000ms
 *   TBT                ≤ 300ms
 */

'use strict'

const lighthouse    = require('lighthouse')
const chromeLauncher = require('chrome-launcher')
const fs            = require('fs')
const path          = require('path')

const TARGET_URL = process.argv[2] || process.env.XIAN_URL || 'https://sakuraxian.com'

const BUDGETS = {
  performance:  70,
  fcp:          2500,
  lcp:          4000,
  tti:          5000,
  tbt:          300,
}

const RESULTS_DIR  = path.resolve(__dirname, '../../test-results')
const REPORT_PATH  = path.join(RESULTS_DIR, 'lighthouse-xian.json')
const HTML_PATH    = path.join(RESULTS_DIR, 'lighthouse-xian.html')

async function run() {
  console.log(`\n[Lighthouse] Auditing: ${TARGET_URL}\n`)

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] })

  const options = {
    logLevel:    'error',
    output:      ['json', 'html'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port:        chrome.port,
    formFactor:  'desktop',
    screenEmulation: {
      mobile:          false,
      width:           1440,
      height:          900,
      deviceScaleFactor: 1,
      disabled:        false,
    },
    throttlingMethod: 'simulate',
    throttling: {
      rttMs:              40,
      throughputKbps:     10240,
      cpuSlowdownMultiplier: 1,
    },
  }

  const runnerResult = await lighthouse(TARGET_URL, options)

  await chrome.kill()

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })

  // Save JSON + HTML reports
  fs.writeFileSync(REPORT_PATH, runnerResult.report[0])
  fs.writeFileSync(HTML_PATH,   runnerResult.report[1])

  // Extract key metrics
  const { lhr } = runnerResult
  const perf  = Math.round((lhr.categories.performance.score ?? 0) * 100)
  const fcp   = Math.round(lhr.audits['first-contentful-paint'].numericValue)
  const lcp   = Math.round(lhr.audits['largest-contentful-paint'].numericValue)
  const tti   = Math.round(lhr.audits['interactive'].numericValue)
  const tbt   = Math.round(lhr.audits['total-blocking-time'].numericValue)

  const metrics = { performance: perf, fcp, lcp, tti, tbt }

  console.log('┌────────────────────────────────────┐')
  console.log('│  Lighthouse Results — Sakura Xian  │')
  console.log('├──────────────────┬─────────────────┤')
  console.log(`│  Performance     │  ${String(perf).padEnd(14)} │`)
  console.log(`│  FCP             │  ${String(fcp + 'ms').padEnd(14)} │`)
  console.log(`│  LCP             │  ${String(lcp + 'ms').padEnd(14)} │`)
  console.log(`│  TTI             │  ${String(tti + 'ms').padEnd(14)} │`)
  console.log(`│  TBT             │  ${String(tbt + 'ms').padEnd(14)} │`)
  console.log('└──────────────────┴─────────────────┘')

  // Budget check
  let passed = true
  if (perf  < BUDGETS.performance) { console.error(`✗ Performance ${perf} < budget ${BUDGETS.performance}`); passed = false }
  if (fcp   > BUDGETS.fcp)         { console.error(`✗ FCP ${fcp}ms > budget ${BUDGETS.fcp}ms`);             passed = false }
  if (lcp   > BUDGETS.lcp)         { console.error(`✗ LCP ${lcp}ms > budget ${BUDGETS.lcp}ms`);             passed = false }
  if (tti   > BUDGETS.tti)         { console.error(`✗ TTI ${tti}ms > budget ${BUDGETS.tti}ms`);             passed = false }
  if (tbt   > BUDGETS.tbt)         { console.error(`✗ TBT ${tbt}ms > budget ${BUDGETS.tbt}ms`);             passed = false }

  if (passed) {
    console.log('\n✓ All Lighthouse budgets met\n')
  } else {
    console.error('\n✗ Budget violations detected\n')
  }

  console.log(`Reports saved to:\n  ${REPORT_PATH}\n  ${HTML_PATH}\n`)

  process.exit(passed ? 0 : 1)
}

run().catch(err => {
  console.error('[Lighthouse] Fatal error:', err.message)
  process.exit(1)
})
