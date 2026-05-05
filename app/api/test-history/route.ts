import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface HistoryPoint {
  date:     string
  passRate: number
  passed:   number
  failed:   number
  total:    number
}

export async function GET() {
  const candidates = [
    path.resolve(process.cwd(), 'test-results/history.json'),
    path.resolve(process.cwd(), '../QA-Sakura-Solutions/test-results/history.json'),
  ]

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    try {
      const data: HistoryPoint[] = JSON.parse(fs.readFileSync(p, 'utf8'))
      return NextResponse.json(data.slice(-14)) // last 14 runs max
    } catch { /* try next */ }
  }

  return NextResponse.json([])
}
