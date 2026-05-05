import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface FlatTestResult {
  id:        string
  suite:     string
  test:      string
  status:    'passed' | 'failed' | 'skipped'
  duration:  number
  timestamp: string
  project?:  string
  error?:    string
}

export interface TestSummary {
  total:     number
  passed:    number
  failed:    number
  skipped:   number
  duration:  number
  runAt:     string | null
  tests:     FlatTestResult[]
}

/* ── Playwright JSON parser ───────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenSuite(suite: any, filePath: string, results: FlatTestResult[]) {
  const suiteName = suite.title || filePath

  // specs at this level
  for (const spec of suite.specs ?? []) {
    for (const testRun of spec.tests ?? []) {
      const result = testRun.results?.[0]
      const status: FlatTestResult['status'] =
        testRun.status === 'expected'  ? 'passed'  :
        testRun.status === 'skipped'   ? 'skipped' : 'failed'

      results.push({
        id:        `${filePath}::${spec.title}::${testRun.projectId ?? ''}`,
        suite:     suiteName,
        test:      spec.title,
        status,
        duration:  result?.duration ?? 0,
        timestamp: result?.startTime ?? new Date().toISOString(),
        project:   testRun.projectId,
        error:     result?.errors?.[0]?.message?.slice(0, 200),
      })
    }
  }

  // recurse into child suites
  for (const child of suite.suites ?? []) {
    flattenSuite(child, filePath, results)
  }
}

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function GET() {
  const resultsPath = path.resolve(process.cwd(), 'test-results', 'results.json')

  if (!fs.existsSync(resultsPath)) {
    return NextResponse.json<TestSummary>({
      total:    0,
      passed:   0,
      failed:   0,
      skipped:  0,
      duration: 0,
      runAt:    null,
      tests:    [],
    })
  }

  try {
    const raw  = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
    const flat: FlatTestResult[] = []

    for (const suite of raw.suites ?? []) {
      const filePath = suite.title || suite.file || 'unknown'
      // top-level specs
      flattenSuite(suite, filePath, flat)
    }

    const stats: TestSummary = {
      total:    flat.length,
      passed:   flat.filter(r => r.status === 'passed').length,
      failed:   flat.filter(r => r.status === 'failed').length,
      skipped:  flat.filter(r => r.status === 'skipped').length,
      duration: raw.stats?.duration ?? 0,
      runAt:    raw.stats?.startTime ?? null,
      tests:    flat,   // all browsers — dashboard shows project column
    }

    return NextResponse.json<TestSummary>(stats)
  } catch (err) {
    console.error('[test-results] Failed to parse results.json:', err)
    return NextResponse.json<TestSummary>({
      total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, runAt: null, tests: [],
    })
  }
}
