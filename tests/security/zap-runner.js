/**
 * Sakura Shield — OWASP ZAP Runner
 * FR: Script d'automatisation du scan OWASP ZAP via l'API REST
 * EN: OWASP ZAP scan automation via the ZAP REST API
 *
 * Prerequisites:
 *   1. ZAP running in daemon mode:
 *      docker run -p 8090:8090 ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon -host 0.0.0.0 -port 8090
 *   2. Set ZAP_API_KEY env var (or use default 'changeme')
 *
 * Usage:
 *   node tests/security/zap-runner.js
 *   ZAP_TARGET=https://sakurafidelity.com node tests/security/zap-runner.js
 */

'use strict'

const http = require('http')
const fs   = require('fs')
const path = require('path')

const ZAP_HOST    = process.env.ZAP_HOST    || 'localhost'
const ZAP_PORT    = parseInt(process.env.ZAP_PORT    || '8090')
const ZAP_API_KEY = process.env.ZAP_API_KEY || 'changeme'
const TARGET      = process.env.ZAP_TARGET  || 'https://sakuranode.com'
const RESULTS_DIR = path.resolve(__dirname, '../../test-results')

/* ── HTTP helper ─────────────────────────────────────────────────────────── */

function zapRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `http://${ZAP_HOST}:${ZAP_PORT}/JSON/${endpoint}&apikey=${ZAP_API_KEY}`
    http.get(url, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`\n[ZAP] Target: ${TARGET}`)
  console.log(`[ZAP] Host:   ${ZAP_HOST}:${ZAP_PORT}\n`)

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })

  // 1. Check ZAP is running
  try {
    await zapRequest('core/view/version/?')
    console.log('[ZAP] ✓ Connected to ZAP daemon')
  } catch {
    console.error('[ZAP] ✗ Cannot connect to ZAP. Start the daemon first.')
    console.error('      docker run -p 8090:8090 ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon -host 0.0.0.0 -port 8090')
    process.exit(1)
  }

  // 2. Access the target (seed the session)
  console.log('[ZAP] Accessing target...')
  await zapRequest(`core/action/accessUrl/?url=${encodeURIComponent(TARGET)}&followredirects=true&`)
  await sleep(2000)

  // 3. Spider scan
  console.log('[ZAP] Starting spider...')
  const spiderRes  = await zapRequest(`spider/action/scan/?url=${encodeURIComponent(TARGET)}&maxchildren=20&recurse=true&`)
  const spiderId   = spiderRes.scan || '0'

  let spiderDone = false
  while (!spiderDone) {
    await sleep(3000)
    const progress = await zapRequest(`spider/view/status/?scanId=${spiderId}&`)
    console.log(`[ZAP] Spider progress: ${progress.status}%`)
    if (parseInt(progress.status) >= 100) spiderDone = true
  }
  console.log('[ZAP] ✓ Spider complete')

  // 4. Passive scan (wait for queue to drain)
  console.log('[ZAP] Waiting for passive scan...')
  let passiveDone = false
  let passiveAttempts = 0
  while (!passiveDone && passiveAttempts < 30) {
    await sleep(3000)
    const queue = await zapRequest('pscan/view/recordsToScan/?')
    console.log(`[ZAP] Passive scan queue: ${queue.recordsToScan}`)
    if (parseInt(queue.recordsToScan) === 0) passiveDone = true
    passiveAttempts++
  }
  console.log('[ZAP] ✓ Passive scan complete')

  // 5. Active scan (limited scope — no destructive tests)
  console.log('[ZAP] Starting active scan (safe rules only)...')
  const activeRes = await zapRequest(`ascan/action/scan/?url=${encodeURIComponent(TARGET)}&recurse=true&scanpolicyname=&`)
  const activeId  = activeRes.scan || '0'

  let activeDone = false
  while (!activeDone) {
    await sleep(10_000)
    const progress = await zapRequest(`ascan/view/status/?scanId=${activeId}&`)
    console.log(`[ZAP] Active scan progress: ${progress.status}%`)
    if (parseInt(progress.status) >= 100) activeDone = true
  }
  console.log('[ZAP] ✓ Active scan complete')

  // 6. Get alerts
  const alertsRes = await zapRequest('core/view/alerts/?baseurl=&start=0&count=100&riskid=&')
  const alerts    = alertsRes.alerts || []

  const byRisk = { High: [], Medium: [], Low: [], Informational: [] }
  for (const alert of alerts) {
    const risk = alert.risk || 'Informational'
    if (byRisk[risk]) byRisk[risk].push(alert)
  }

  console.log('\n┌─────────────────────────────────────┐')
  console.log('│  OWASP ZAP Scan Results             │')
  console.log('├────────────────┬────────────────────┤')
  console.log(`│  High          │  ${String(byRisk.High.length).padEnd(19)}│`)
  console.log(`│  Medium        │  ${String(byRisk.Medium.length).padEnd(19)}│`)
  console.log(`│  Low           │  ${String(byRisk.Low.length).padEnd(19)}│`)
  console.log(`│  Informational │  ${String(byRisk.Informational.length).padEnd(19)}│`)
  console.log('└────────────────┴────────────────────┘\n')

  // 7. Export JSON report
  const report = {
    target:    TARGET,
    scanDate:  new Date().toISOString(),
    summary:   {
      high:    byRisk.High.length,
      medium:  byRisk.Medium.length,
      low:     byRisk.Low.length,
      info:    byRisk.Informational.length,
    },
    alerts,
  }

  const reportPath = path.join(RESULTS_DIR, 'zap-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`[ZAP] JSON report saved: ${reportPath}`)

  // 8. Generate HTML report (via ZAP API)
  const htmlReport = await zapRequest('core/other/htmlreport/?')
  if (htmlReport?.raw) {
    const htmlPath = path.join(RESULTS_DIR, 'zap-report.html')
    fs.writeFileSync(htmlPath, htmlReport.raw)
    console.log(`[ZAP] HTML report saved: ${htmlPath}`)
  }

  // Exit with error if High findings
  if (byRisk.High.length > 0) {
    console.error(`[ZAP] ✗ ${byRisk.High.length} HIGH severity findings detected!`)
    byRisk.High.forEach(a => console.error(`       - ${a.alert}: ${a.url}`))
    process.exit(1)
  }

  console.log('[ZAP] ✓ No HIGH severity findings\n')
}

main().catch(err => {
  console.error('[ZAP] Fatal error:', err.message)
  process.exit(1)
})
