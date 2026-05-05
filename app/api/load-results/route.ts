import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface LoadSummary {
  p95:      number | null   // http_req_duration p(95) in ms
  maxVU:    number | null   // peak virtual users
  rps:      number | null   // requests per second (avg)
  failRate: number | null   // 0–100 %
  ranAt:    string | null
}

export async function GET() {
  const summaryPath = path.resolve(process.cwd(), 'test-results', 'k6-summary.json')

  if (!fs.existsSync(summaryPath)) {
    return NextResponse.json<LoadSummary>({ p95: null, maxVU: null, rps: null, failRate: null, ranAt: null })
  }

  try {
    const raw  = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
    const m    = raw.metrics ?? {}

    const p95      = m['http_req_duration']?.values?.['p(95)']  ?? null
    const maxVU    = m['vus_max']?.values?.max                   ?? null
    const rps      = m['http_reqs']?.values?.rate                ?? null
    const failRate = m['http_req_failed']?.values?.rate != null
      ? Math.round(m['http_req_failed'].values.rate * 10000) / 100   // 0.00–100.00 %
      : null

    return NextResponse.json<LoadSummary>({
      p95:      p95      !== null ? Math.round(p95)      : null,
      maxVU:    maxVU    !== null ? Math.round(maxVU)    : null,
      rps:      rps      !== null ? Math.round(rps)      : null,
      failRate: failRate !== null ? failRate              : null,
      ranAt:    raw.state?.testRunDurationMs ? new Date().toISOString() : null,
    })
  } catch (err) {
    console.error('[load-results] Failed to parse k6-summary.json:', err)
    return NextResponse.json<LoadSummary>({ p95: null, maxVU: null, rps: null, failRate: null, ranAt: null })
  }
}
