/**
 * Sakura Shield — k6 Smoke Test (CI)
 * FR: Smoke test léger pour la CI — vérifie que les endpoints live répondent
 *     correctement sous charge minimale (3 VU / 60s).
 *     Lance aussi un appel API sanity sur health-proxy.
 * EN: Lightweight CI smoke test — verifies live endpoints respond correctly
 *     under minimal load (3 VUs / 60s). Also runs an API sanity check
 *     on the health-proxy route.
 *
 * Thresholds (SLA — intentionally relaxed for smoke):
 *   - p(95) < 2 000ms   (network variance on CI runners)
 *   - error rate < 5%   (endpoint alive check, not a stress gate)
 *
 * Usage:
 *   k6 run tests/load/k6-smoke.js
 *   k6 run tests/load/k6-smoke.js -e BASE_URL=https://sakuranode.com
 */

import http   from 'k6/http'
import { sleep, check, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { textSummary }          from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

/* ── Custom metrics ──────────────────────────────────────────────────────── */
const errorCount  = new Counter('sakura_smoke_errors')
const successRate = new Rate('sakura_smoke_success')
const latency     = new Trend('sakura_smoke_latency_ms', true)

/* ── Options ─────────────────────────────────────────────────────────────── */
export const options = {
  vus:      3,
  duration: '60s',
  thresholds: {
    'http_req_duration':    ['p(95)<2000'],
    'http_req_failed':      ['rate<0.05'],
    'sakura_smoke_success': ['rate>0.95'],
    'sakura_smoke_latency_ms': ['p(95)<2000'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://sakuranode.com'

/* ── Scenario ────────────────────────────────────────────────────────────── */
export default function () {
  const targets = [
    { tag: 'homepage',  url: BASE_URL },
    { tag: 'dashboard', url: `${BASE_URL}/engineering-dashboard` },
    { tag: 'health',    url: `${BASE_URL}/api/health-proxy?url=${encodeURIComponent('https://sakurarewards.com')}` },
  ]

  for (const target of targets) {
    group(target.tag, () => {
      const t0  = Date.now()
      const res = http.get(target.url, {
        headers: { 'Accept-Encoding': 'gzip, deflate, br' },
        tags:    { name: target.tag },
      })
      latency.add(Date.now() - t0)

      const ok = check(res, {
        [`${target.tag} — status < 400`]:  r => r.status < 400,
        [`${target.tag} — body non-empty`]: r => (r.body?.length ?? 0) > 0,
      })
      successRate.add(ok)
      if (!ok) errorCount.add(1)
    })
    sleep(0.5)
  }
}

/* ── Summary ─────────────────────────────────────────────────────────────── */
export function handleSummary(data) {
  return {
    'test-results/k6-smoke-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  }
}
