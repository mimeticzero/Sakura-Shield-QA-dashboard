import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface LoadSummary {
  p95:       number | null   // http_req_duration p(95) in ms
  maxVU:     number | null   // peak virtual users
  rps:       number | null   // requests per second (avg)
  failRate:  number | null   // 0–100 %
  ranAt:     string | null
  scenario:  string | null   // 'smoke' | 'load' | 'stress' | 'soak'
  passed:    boolean | null  // all thresholds passed
}

function parseK6Summary(raw: Record<string, unknown>): Omit<LoadSummary, 'ranAt' | 'scenario'> {
  const m = (raw.metrics ?? {}) as Record<string, { values?: Record<string, number> }>

  const p95      = m['http_req_duration']?.values?.['p(95)']  ?? null
  const maxVU    = m['vus_max']?.values?.max                   ?? null
  const rps      = m['http_reqs']?.values?.rate                ?? null
  const rawFail  = m['http_req_failed']?.values?.rate

  const failRate = rawFail != null
    ? Math.round(rawFail * 10000) / 100   // 0.00–100.00 %
    : null

  // Determine if all thresholds passed — k6 sets thresholds with boolean results
  const thresholds = (raw as Record<string, unknown>)['thresholds'] as
    Record<string, { ok: boolean }> | undefined
  const passed = thresholds != null
    ? Object.values(thresholds).every(t => t.ok)
    : null

  return {
    p95:      p95      !== null ? Math.round(p95)   : null,
    maxVU:    maxVU    !== null ? Math.round(maxVU)  : null,
    rps:      rps      !== null ? Math.round(rps)    : null,
    failRate: failRate !== null ? failRate            : null,
    passed,
  }
}

export async function GET() {
  const dir = path.resolve(process.cwd(), 'test-results')

  // Priority: smoke (CI auto-run) → full load → stress results
  const candidates = [
    { file: path.join(dir, 'k6-smoke-summary.json'),  scenario: 'smoke'  },
    { file: path.join(dir, 'k6-summary.json'),         scenario: 'load'   },
    { file: path.join(dir, 'k6-spike-summary.json'),   scenario: 'stress' },
    { file: path.join(dir, 'k6-soak-summary.json'),    scenario: 'soak'   },
  ]

  for (const { file, scenario } of candidates) {
    if (!fs.existsSync(file)) continue

    try {
      const raw    = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
      const parsed = parseK6Summary(raw)

      // Best-effort timestamp: prefer file mtime over "now"
      const mtime = fs.statSync(file).mtime.toISOString()

      return NextResponse.json<LoadSummary>({ ...parsed, ranAt: mtime, scenario })
    } catch (err) {
      console.error(`[load-results] Failed to parse ${file}:`, err)
    }
  }

  return NextResponse.json<LoadSummary>({
    p95: null, maxVU: null, rps: null, failRate: null,
    ranAt: null, scenario: null, passed: null,
  })
}
