/**
 * Sakura Shield — k6 Load Test: Sakura Node
 * FR: Simulation de 1 000 utilisateurs virtuels sur Sakura Node
 * EN: 1 000 virtual users load simulation on Sakura Node
 *
 * Stages:
 *   0→3min  : ramp up to 1 000 VU
 *   3→8min  : hold at 1 000 VU (stress plateau)
 *   8→10min : ramp down to 0
 *
 * Thresholds (SLA):
 *   - 95th percentile response time < 500ms
 *   - Error rate < 1%
 *   - HTTP 200 rate > 99%
 */

import http   from 'k6/http'
import { sleep, check, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

/* ── Custom metrics ──────────────────────────────────────────────────────── */
const errorCount       = new Counter('sakura_errors')
const successRate      = new Rate('sakura_success_rate')
const homeLoadTime     = new Trend('sakura_home_load_ms', true)
const apiResponseTime  = new Trend('sakura_api_response_ms', true)

/* ── Options ─────────────────────────────────────────────────────────────── */

export const options = {
  stages: [
    { duration: '3m',  target: 1000 },  // ramp up
    { duration: '5m',  target: 1000 },  // hold
    { duration: '2m',  target: 0    },  // ramp down
  ],
  thresholds: {
    // SLA: p95 < 500ms
    'http_req_duration':          ['p(95)<500', 'p(99)<1000'],
    // SLA: < 1% errors
    'http_req_failed':            ['rate<0.01'],
    // Custom metrics
    'sakura_success_rate':        ['rate>0.99'],
    'sakura_home_load_ms':        ['p(95)<600'],
    'sakura_api_response_ms':     ['p(95)<300'],
  },
  // Cloud output (optional — requires k6 Cloud token)
  // ext: { loadimpact: { projectID: 0, name: 'Sakura Node Load Test' } },
}

const BASE_URL = __ENV.BASE_URL || 'https://sakuranode.com'

/* ── Scenario ────────────────────────────────────────────────────────────── */

export default function () {
  group('Homepage', () => {
    const t0  = Date.now()
    const res = http.get(BASE_URL, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
      tags:    { name: 'homepage' },
    })
    homeLoadTime.add(Date.now() - t0)

    const ok = check(res, {
      'status is 200':          r => r.status === 200,
      'body contains Sakura':   r => r.body.includes('Sakura') || r.body.includes('sakura'),
      'response < 500ms':       r => r.timings.duration < 500,
    })
    successRate.add(ok)
    if (!ok) errorCount.add(1)
  })

  sleep(Math.random() * 2 + 0.5) // think time 0.5–2.5s

  group('PWA Manifest', () => {
    const res = http.get(`${BASE_URL}/favicon/site.webmanifest`, {
      tags: { name: 'manifest' },
    })
    check(res, {
      'manifest 200': r => r.status === 200,
    })
  })

  sleep(Math.random() * 1.5)

  group('Engineering Dashboard', () => {
    const t0  = Date.now()
    const res = http.get(`${BASE_URL}/engineering-dashboard`, {
      tags: { name: 'eng-dashboard' },
    })
    apiResponseTime.add(Date.now() - t0)

    check(res, {
      'dashboard reachable': r => [200, 304].includes(r.status),
      'dashboard < 800ms':   r => r.timings.duration < 800,
    })
  })

  sleep(Math.random() * 1)

  group('Health Proxy API', () => {
    const res = http.get(
      `${BASE_URL}/api/health-proxy?url=${encodeURIComponent('https://sakurarewards.com')}`,
      { tags: { name: 'health-proxy' } }
    )
    check(res, {
      'health proxy 200': r => r.status === 200,
    })
  })

  sleep(Math.random() * 2)
}

/* ── Summary formatter ───────────────────────────────────────────────────── */

export function handleSummary(data) {
  return {
    'test-results/k6-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  }
}
