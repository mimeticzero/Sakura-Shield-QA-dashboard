/**
 * run-lighthouse.mjs
 * Runs Lighthouse on all 4 Sakura projects and writes test-results/lighthouse-projects.json
 * Usage: node scripts/run-lighthouse.mjs
 * Requires: npm install -g lighthouse  (or npx works too)
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT  = path.join(ROOT, 'test-results', 'lighthouse-projects.json')
const TMP  = path.join(ROOT, 'test-results', '_lh-tmp')

const PROJECTS = [
  { key: 'sakura-node',     url: 'https://sakuranode.com'     },
  { key: 'sakura-fidelity', url: 'https://sakurafidelity.com' },
  { key: 'sakura-rewards',  url: 'https://sakurarewards.com'  },
  { key: 'sakura-xian',     url: 'https://sakuraxian.com'     },
]

fs.mkdirSync(TMP, { recursive: true })

const results = {}

for (const { key, url } of PROJECTS) {
  const tmpFile = path.join(TMP, `${key}.json`)
  console.log(`\nRunning Lighthouse for ${key} (${url}) ...`)

  try {
    execSync(
      `npx lighthouse ${url} --output=json --output-path="${tmpFile}" --chrome-flags="--headless --no-sandbox" --quiet`,
      { stdio: 'inherit', timeout: 120_000 }
    )

    const raw = JSON.parse(fs.readFileSync(tmpFile, 'utf8'))

    results[key] = {
      performance:   Math.round((raw.categories?.performance?.score  ?? 0) * 100),
      accessibility: Math.round((raw.categories?.accessibility?.score ?? 0) * 100),
      seo:           Math.round((raw.categories?.seo?.score           ?? 0) * 100),
      bestPractices: Math.round((raw.categories?.['best-practices']?.score ?? 0) * 100),
      fcp:           Math.round(raw.audits?.['first-contentful-paint']?.numericValue ?? 0),
      lcp:           Math.round(raw.audits?.['largest-contentful-paint']?.numericValue ?? 0),
      tti:           Math.round(raw.audits?.['interactive']?.numericValue ?? 0),
      ranAt:         raw.fetchTime ?? new Date().toISOString(),
      simulated:     false,
    }

    console.log(`  OK — perf: ${results[key].performance}  a11y: ${results[key].accessibility}  seo: ${results[key].seo}`)
  } catch (err) {
    console.error(`  FAILED for ${key}: ${err.message}`)
    // keep existing simulated data if present
    const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
    if (existing[key]) results[key] = existing[key]
  }
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
console.log(`\nWritten to ${OUT}`)

// cleanup tmp
fs.rmSync(TMP, { recursive: true, force: true })
