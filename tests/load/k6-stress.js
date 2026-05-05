/**
 * Sakura Shield — k6 Stress Test (spike + soak)
 * FR: Test de stress avec pic soudain et test d'endurance (soak)
 * EN: Spike + soak stress test for the Sakura ecosystem
 *
 * Usage:
 *   k6 run tests/load/k6-stress.js
 *   k6 run tests/load/k6-stress.js -e SCENARIO=spike
 *   k6 run tests/load/k6-stress.js -e SCENARIO=soak
 */

import http  from 'k6/http'
import { sleep, check, group } from 'k6'
import { Rate, Trend }         from 'k6/metrics'
import { textSummary }         from 'https://jslib.k6.io/k6-summary/0.0.2/index.js'

const errorRate   = new Rate('sakura_stress_errors')
const p95Tracker  = new Trend('sakura_p95_tracker', true)

const BASE_URL    = __ENV.BASE_URL  || 'https://sakuranode.com'
const SCENARIO    = __ENV.SCENARIO  || 'spike'

/* ── Spike: sudden 2 000 VU burst ─────────────────────────────────────────── */
const spikeOptions = {
  stages: [
    { duration: '30s', target: 100  },
    { duration: '1m',  target: 2000 },  // spike
    { duration: '30s', target: 100  },
    { duration: '30s', target: 0    },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed':   ['rate<0.05'],
  },
}

/* ── Soak: sustained load for 30 min ─────────────────────────────────────── */
const soakOptions = {
  stages: [
    { duration: '5m',  target: 300 },
    { duration: '20m', target: 300 },  // hold
    { duration: '5m',  target: 0   },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<600'],
    'http_req_failed':   ['rate<0.01'],
  },
}

export const options = SCENARIO === 'soak' ? soakOptions : spikeOptions

/* ── Scenario ────────────────────────────────────────────────────────────── */

export default function () {
  group('Core pages', () => {
    const pages = [
      { name: 'home',      url: BASE_URL },
      { name: 'dashboard', url: `${BASE_URL}/engineering-dashboard` },
    ]

    for (const page of pages) {
      const t0  = Date.now()
      const res = http.get(page.url, { tags: { name: page.name } })
      p95Tracker.add(Date.now() - t0)

      const ok = check(res, { [`${page.name} 200`]: r => r.status === 200 })
      errorRate.add(!ok)
      sleep(0.3)
    }
  })
}

export function handleSummary(data) {
  return {
    [`test-results/k6-${SCENARIO}-summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  }
}
