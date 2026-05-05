import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface A11yAppResult {
  app:        string
  url:        string
  scanAt:     string
  critical:   number
  serious:    number
  moderate:   number
  minor:      number
  violations: Array<{
    id:          string
    impact:      string | undefined
    description: string
    nodes:       number
  }>
}

export async function GET() {
  const filePath = path.resolve(process.cwd(), 'test-results', 'a11y-results.json')

  if (!fs.existsSync(filePath)) {
    return NextResponse.json<A11yAppResult[]>([])
  }

  try {
    const results = JSON.parse(fs.readFileSync(filePath, 'utf8')) as A11yAppResult[]
    return NextResponse.json(results)
  } catch (err) {
    console.error('[a11y-results] Failed to parse a11y-results.json:', err)
    return NextResponse.json<A11yAppResult[]>([])
  }
}
