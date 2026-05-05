import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface LighthouseScores {
  performance:   number
  accessibility: number
  seo:           number
  bestPractices: number
  fcp:           number
  lcp:           number
  tti:           number
  ranAt:         string | null
  simulated:     boolean
}

export type LighthouseAllProjects = Record<string, LighthouseScores>

export async function GET() {
  // Try multi-project file first
  const multiCandidates = [
    path.resolve(process.cwd(), 'test-results/lighthouse-projects.json'),
    path.resolve(process.cwd(), '../QA-Sakura-Solutions/test-results/lighthouse-projects.json'),
  ]
  for (const p of multiCandidates) {
    if (!fs.existsSync(p)) continue
    try {
      return NextResponse.json<LighthouseAllProjects>(JSON.parse(fs.readFileSync(p, 'utf8')))
    } catch { /* try next */ }
  }

  // Fallback: single Xian report (full or summary)
  const singleCandidates = [
    path.resolve(process.cwd(), 'test-results/lighthouse-xian.json'),
    path.resolve(process.cwd(), '../QA-Sakura-Solutions/test-results/lighthouse-xian.json'),
    path.resolve(process.cwd(), 'test-results/lighthouse-summary.json'),
    path.resolve(process.cwd(), '../QA-Sakura-Solutions/test-results/lighthouse-summary.json'),
  ]
  for (const p of singleCandidates) {
    if (!fs.existsSync(p)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
      const scores: LighthouseScores = raw.categories ? {
        performance:   Math.round((raw.categories?.performance?.score  ?? 0) * 100),
        accessibility: Math.round((raw.categories?.accessibility?.score ?? 0) * 100),
        seo:           Math.round((raw.categories?.seo?.score           ?? 0) * 100),
        bestPractices: Math.round((raw.categories?.['best-practices']?.score ?? 0) * 100),
        fcp:           Math.round(raw.audits?.['first-contentful-paint']?.numericValue ?? 0),
        lcp:           Math.round(raw.audits?.['largest-contentful-paint']?.numericValue ?? 0),
        tti:           Math.round(raw.audits?.['interactive']?.numericValue ?? 0),
        ranAt:         raw.fetchTime ?? null,
        simulated:     false,
      } : { ...raw, simulated: raw.simulated ?? true }

      return NextResponse.json<LighthouseAllProjects>({ 'sakura-xian': scores })
    } catch { /* try next */ }
  }

  return NextResponse.json<LighthouseAllProjects>({})
}
