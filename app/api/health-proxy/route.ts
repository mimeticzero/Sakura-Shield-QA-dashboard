import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const ALLOWED_HOSTS = [
  'sakuranode.com',
  'sakurarewards.com',
  'sakurafidelity.com',
  'sakuraxian.com',
  'skolvex.com',
]

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const rawUrl = searchParams.get('url')

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const hostname = parsed.hostname.replace(/^www\./, '')
  if (!ALLOWED_HOSTS.includes(hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  try {
    const upstream = await fetch(rawUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
    })
    return NextResponse.json({ status: upstream.status, ok: upstream.ok }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'unreachable' }, { status: 200 })
  }
}
