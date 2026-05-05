import { NextResponse } from 'next/server'
import * as fs   from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export interface GitContext {
  shortSha: string
  sha:      string
  message:  string
  author:   string
  date:     string
}

export async function GET() {
  // Try real git log first
  try {
    const { execSync } = await import('child_process')
    const log = execSync(
      'git log -1 --pretty=format:%H%n%h%n%s%n%an%n%cI',
      { cwd: process.cwd(), timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim().split('\n')

    if (log.length >= 5) {
      return NextResponse.json<GitContext>({
        sha:      log[0],
        shortSha: log[1],
        message:  log[2],
        author:   log[3],
        date:     log[4],
      })
    }
  } catch { /* not a git repo or git not available */ }

  // Fallback to static file
  const candidates = [
    path.resolve(process.cwd(), 'test-results/git-context.json'),
    path.resolve(process.cwd(), '../QA-Sakura-Solutions/test-results/git-context.json'),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    try {
      return NextResponse.json<GitContext>(JSON.parse(fs.readFileSync(p, 'utf8')))
    } catch { /* try next */ }
  }

  return NextResponse.json<GitContext>({
    shortSha: '—', sha: '—', message: '—', author: '—', date: new Date().toISOString(),
  })
}
