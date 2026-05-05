'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface ServiceStatus {
  name:      string
  url:       string
  status:    'live' | 'degraded' | 'down' | 'checking'
  latency:   number | null
  lastCheck: string
}

interface TestResult {
  id:        string
  suite:     string
  test:      string
  status:    'passed' | 'failed' | 'skipped'
  duration:  number
  timestamp: string
  project?:  string
  error?:    string
}

interface TestSummary {
  total:    number
  passed:   number
  failed:   number
  skipped:  number
  duration: number
  runAt:    string | null
  tests:    TestResult[]
}

interface LoadSummary {
  p95:      number | null
  maxVU:    number | null
  rps:      number | null
  failRate: number | null
  ranAt:    string | null
}

interface LighthouseScores {
  performance:   number
  accessibility: number
  seo:           number
  bestPractices: number
  fcp:           number
  lcp:           number
  tti:           number
  ranAt:         string | null
}

interface HistoryPoint {
  date:     string
  passRate: number
  passed:   number
  failed:   number
  total:    number
}

interface GitContext {
  shortSha: string
  sha:      string
  message:  string
  author:   string
  date:     string
}

/* ── Animated Counter ────────────────────────────────────────────────────── */

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref      = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const motionVal = useMotionValue(0)
  const rounded   = useTransform(motionVal, v => Math.round(v))

  useEffect(() => {
    if (!isInView) return
    const controls = animate(motionVal, value, { duration: 1.8, ease: 'easeOut' })
    return controls.stop
  }, [isInView, motionVal, value])

  useEffect(() => {
    return rounded.on('change', v => {
      if (ref.current) ref.current.textContent = `${v}${suffix}`
    })
  }, [rounded, suffix])

  return <span ref={ref}>0{suffix}</span>
}

/* ── Circular Gauge ──────────────────────────────────────────────────────── */

function CircularGauge({ score, label, tooltip, size = 88 }: { score: number; label: string; tooltip?: string; size?: number }) {
  const color  = score >= 90 ? '#00f5ff' : score >= 70 ? '#f59e0b' : '#ff2d78'
  const r      = (size - 10) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div title={tooltip} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: tooltip ? 'help' : 'default' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.4s ease' }}
        />
        <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="15" fontWeight="700" fontFamily="Orbitron, sans-serif"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
          {score}
        </text>
      </svg>
      <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#64748b' }}>{label}</div>
    </div>
  )
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */

function Sparkline({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) return null
  const W = 260; const H = 56; const pad = 6
  const vals    = data.map(d => d.passRate)
  const minV    = Math.min(...vals) - 4
  const maxV    = Math.max(...vals) + 4
  const scaleX  = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2)
  const scaleY  = (v: number) => H - pad - ((v - minV) / (maxV - minV)) * (H - pad * 2)
  const points  = data.map((d, i) => `${scaleX(i)},${scaleY(d.passRate)}`).join(' ')
  const areaBot = `${scaleX(data.length - 1)},${H} ${scaleX(0)},${H}`
  const lastVal = vals[vals.length - 1]
  const color   = lastVal >= 90 ? '#00f5ff' : lastVal >= 70 ? '#f59e0b' : '#ff2d78'
  const trend   = vals[vals.length - 1] - vals[0]
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="spk-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${points} ${areaBot}`} fill="url(#spk-grad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        {data.map((d, i) => (
          <circle key={i} cx={scaleX(i)} cy={scaleY(d.passRate)} r="3" fill={color}>
            <title>{d.date} : {d.passRate}%</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{data[0].date.slice(5)}</span>
        <span style={{ fontSize: '12px', color: trend >= 0 ? '#00f5ff' : '#ff2d78' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{data[data.length - 1].date.slice(5)}</span>
      </div>
    </div>
  )
}

/* ── Services ────────────────────────────────────────────────────────────── */

const SERVICES_INITIAL: ServiceStatus[] = [
  { name: 'Sakura Node',     url: 'https://sakuranode.com',     status: 'checking', latency: null, lastCheck: '—' },
  { name: 'Sakura Fidelity', url: 'https://sakurafidelity.com', status: 'checking', latency: null, lastCheck: '—' },
  { name: 'Sakura Rewards',  url: 'https://sakurarewards.com',  status: 'checking', latency: null, lastCheck: '—' },
  { name: 'Sakura Xian',     url: 'https://sakuraxian.com',     status: 'checking', latency: null, lastCheck: '—' },
  { name: 'Skolvex',         url: 'https://skolvex.com',        status: 'checking', latency: null, lastCheck: '—' },
]

/* ── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, suffix, color }: {
  label: string; value: number; suffix?: string; color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${color}33`,
        borderTop: `2px solid ${color}`,
        padding: '20px 24px',
        borderRadius: '2px',
        flex: '1 1 160px',
        minWidth: '140px',
      }}
    >
      <div style={{ fontSize: '12px', letterSpacing: '3px', color: '#64748b', marginBottom: '8px', textAlign: 'center' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontFamily: 'Orbitron, sans-serif', color, fontWeight: 700, textAlign: 'center' }}>
        <AnimatedNumber value={value} suffix={suffix} />
      </div>
    </motion.div>
  )
}

/* ── Relative time ───────────────────────────────────────────────────────── */

function relativeTime(isoDate: string | null, lang: 'en' | 'fr'): string {
  if (!isoDate) return '—'
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (diff < 60)   return lang === 'fr' ? `il y a ${diff}s`       : `${diff}s ago`
  if (diff < 3600) return lang === 'fr' ? `il y a ${Math.floor(diff/60)} min` : `${Math.floor(diff/60)} min ago`
  if (diff < 86400)return lang === 'fr' ? `il y a ${Math.floor(diff/3600)}h`  : `${Math.floor(diff/3600)}h ago`
  return lang === 'fr' ? `il y a ${Math.floor(diff/86400)}j` : `${Math.floor(diff/86400)}d ago`
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function EngineeringDashboard() {
  const [services,       setServices]       = useState<ServiceStatus[]>(SERVICES_INITIAL)
  const [testSummary,    setTestSummary]    = useState<TestSummary | null>(null)
  const [loadSummary,    setLoadSummary]    = useState<LoadSummary | null>(null)
  const [lhAllData,      setLhAllData]      = useState<Record<string, LighthouseScores & { simulated?: boolean }>>({})
  const [lhProject,      setLhProject]      = useState('sakura-xian')
  const [history,        setHistory]        = useState<HistoryPoint[]>([])
  const [gitCtx,         setGitCtx]         = useState<GitContext | null>(null)
  const [resultsLoading, setResultsLoading] = useState(true)
  const [lang,           setLang]           = useState<'en' | 'fr'>('en')
  const [now,            setNow]            = useState(Date.now())

  // Tick for relative timestamps
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  void now // used via relativeTime

  /* ── Fetches ── */
  useEffect(() => {
    const load = async () => {
      setResultsLoading(true)
      try {
        const res = await fetch('/api/test-results', { cache: 'no-store' })
        if (res.ok) setTestSummary(await res.json())
      } catch { /* no-op */ }
      finally { setResultsLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    fetch('/api/load-results',      { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setLoadSummary(d) }).catch(() => {})
    fetch('/api/lighthouse-results',{ cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d && Object.keys(d).length) setLhAllData(d) }).catch(() => {})
    fetch('/api/test-history',      { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.length) setHistory(d) }).catch(() => {})
    fetch('/api/git-context',       { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setGitCtx(d) }).catch(() => {})
  }, [])

  /* ── Health checks ── */
  const runHealthChecks = useCallback(async () => {
    const updated: ServiceStatus[] = await Promise.all(
      SERVICES_INITIAL.map(async svc => {
        const t0 = Date.now()
        try {
          const res     = await fetch(`/api/health-proxy?url=${encodeURIComponent(svc.url)}`, { signal: AbortSignal.timeout(4000) })
          const latency = Date.now() - t0
          const body    = await res.json().catch(() => ({ ok: false }))
          return { ...svc, status: (res.ok && body.ok) ? 'live' : 'degraded', latency, lastCheck: new Date().toLocaleTimeString() } as ServiceStatus
        } catch {
          return { ...svc, status: 'down', latency: null, lastCheck: new Date().toLocaleTimeString() } as ServiceStatus
        }
      })
    )
    setServices(updated)
  }, [])

  useEffect(() => {
    runHealthChecks()
    const id = setInterval(runHealthChecks, 60_000)
    return () => clearInterval(id)
  }, [runHealthChecks])

  /* ── Sound alert on failure ── */
  useEffect(() => {
    if (!testSummary || testSummary.failed === 0) return
    try {
      const ctx  = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(); osc.stop(ctx.currentTime + 0.5)
    } catch { /* audio not available */ }
  }, [testSummary])

  /* ── Derived stats ── */
  const lighthouse    = lhAllData[lhProject] ?? null
  const lhSimulated   = lighthouse?.simulated !== false
  const hasRealData = testSummary !== null && testSummary.total > 0
  const total   = hasRealData ? testSummary!.total   : 0
  const passed  = hasRealData ? testSummary!.passed  : 0
  const failed  = hasRealData ? testSummary!.failed  : 0
  const skipped = hasRealData ? testSummary!.skipped : 0
  const tests   = hasRealData ? testSummary!.tests   : []
  const runAt   = testSummary?.runAt ?? null
  const passRate = (passed + failed) > 0 ? Math.round((passed / (passed + failed)) * 100) : 0
  const hasFailed = failed > 0

  /* ── Flaky tests: same test name, different status across browsers ── */
  const flakyIds = new Set<string>()
  if (hasRealData) {
    const byName = new Map<string, Set<string>>()
    for (const t of tests) {
      const statuses = byName.get(t.test) ?? new Set()
      statuses.add(t.status)
      byName.set(t.test, statuses)
    }
    for (const [name, statuses] of byName) {
      if (statuses.has('passed') && statuses.has('failed')) {
        for (const t of tests) if (t.test === name) flakyIds.add(t.id)
      }
    }
  }

  /* ── Browser matrix: suites × browsers ── */
  const suites  = [...new Set(tests.map(t => t.suite))]
  const browsers = [...new Set(tests.map(t => t.project).filter(Boolean))] as string[]

  function matrixStatus(suite: string, browser: string): 'passed' | 'failed' | 'skipped' | null {
    const row = tests.filter(t => t.suite === suite && t.project === browser)
    if (!row.length) return null
    if (row.some(t => t.status === 'failed'))  return 'failed'
    if (row.some(t => t.status === 'skipped')) return 'skipped'
    return 'passed'
  }

  /* ── Helpers ── */
  const statusColor = (s: ServiceStatus['status']) =>
    ({ live: '#00f5ff', degraded: '#f59e0b', down: '#ff2d78', checking: '#64748b' })[s]

  const testColor = (s: TestResult['status']) =>
    ({ passed: '#00f5ff', failed: '#ff2d78', skipped: '#f59e0b' })[s]

  const testLabel = (s: TestResult['status']) => lang === 'fr'
    ? ({ passed: 'RÉUSSI', failed: 'ÉCHOUÉ', skipped: 'IGNORÉ' } as Record<string, string>)[s] ?? s.toUpperCase()
    : s.toUpperCase()

  const TEST_FR: Record<string, string> = {
    'should load the Fidelity homepage':                                          'Chargement de la page d\'accueil Fidelity',
    'should render the login form':                                               'Rendu du formulaire de connexion',
    'should return 403 and not deduct points when balance is insufficient':       'Retourne 403, solde insuffisant, aucun point déduit',
    'point balance should not change after a failed redemption attempt':          'Solde inchangé après un échec de remboursement',
    'transaction history endpoint should require authentication':                 'Historique des transactions : authentification requise',
    'should load play page with a valid token':                                   'Chargement de la page de jeu avec un token valide',
    'should render the spin wheel component':                                     'Rendu du composant roue de la fortune',
    'spin wheel 50 times and log JSON results':                                   'Faire tourner la roue 50 fois, enregistrement JSON',
    'should validate spin distribution matches configured probabilities':          'Distribution des gains conforme aux probabilités',
    'should load the Xian homepage with status 200':                             'Chargement de la page Xian (HTTP 200)',
    'should serve all audio tracks with HTTP 200':                               'Tous les fichiers audio servis en HTTP 200',
    'should change track and fire a new audio request':                          'Changement de piste et nouvelle requête audio',
    'should display playlist items in the UI':                                   'Affichage de la playlist dans l\'interface',
    'should meet Lighthouse performance budget':                                  'Budget de performance Lighthouse respecté',
    'should display Case 1 (Elena) on the select screen':                        'Cas 1 (Elena) affiché sur l\'écran de sélection',
    'should launch Case 1 and reach Round 1 argument selection':                 'Lancement du Cas 1, atteindre la sélection Round 1',
    'should update Tension Gauge after Round 1 argument A is selected':          'Jauge de tension mise à jour après argument A',
    'should reach an Acquittal verdict and persist to Judge File':               'Acquittement obtenu et persisté dans le Dossier Juge',
    "Judge's File should list Elena Vasquez after case completion":              'Le Dossier du Juge liste Elena Vasquez après la fin du cas',
  }
  const testName = (name: string) => lang === 'fr' ? (TEST_FR[name] ?? name) : name

  /* ── i18n ── */
  const tr = {
    en: {
      title:          'ENGINEERING DASHBOARD',
      subtitle:       'QA & Automation Suite · Live',
      health:         'SERVICE HEALTH',
      tests:          'LATEST TEST RUNS',
      security:       'SECURITY',
      links:          'QUICK LINKS',
      viewCode:       'VIEW SOURCE CODE',
      liveDemo:       'LIVE DEMO',
      zapBadge:       'OWASP ZAP SCANNED',
      zapDate:        'Last scan: 2025-05-05',
      zapCounts:      ['0 High', '3 Medium', '12 Low'],
      zapReport:      'VIEW FULL REPORT →',
      suite:          'SUITE',
      test:           'TEST',
      status:         'STATUS',
      duration:       'DURATION',
      browser:        'BROWSER',
      total:          'TOTAL TESTS',
      passed_label:   'PASSED',
      failed_label:   'FAILED',
      coverage_label: 'PASS RATE',
      p95_label:      'SKIPPED',
      no_results:     'No test run yet. Run: npm run test:e2e',
      last_run:       'Last run',
      loading:        'Loading...',
      by_author:      'by',
      k6_maxvu:       'MAX VU',
      k6_maxvu_tip:   'Peak concurrent virtual users during the load test',
      k6_rps:         'RPS PEAK',
      k6_rps_tip:     'Average HTTP requests per second over the full test duration',
      k6_p95:         'P95',
      k6_p95_tip:     '95th percentile response time',
      k6_fail:        'FAIL RATE',
      k6_fail_tip:    'Percentage of HTTP requests that returned an error',
      lh_section:     'LIGHTHOUSE AUDIT',
      lh_sim_note:    'Simulated score',
      lh_sim_tip:     'This score is simulated. To generate real data for this project, run: npx lighthouse <url> --output=json --output-path=test-results/lighthouse-projects.json',
      lh_select:      'Project',
      lh_projects:    { 'sakura-node': 'Sakura Node', 'sakura-fidelity': 'Sakura Fidelity', 'sakura-rewards': 'Sakura Rewards', 'sakura-xian': 'Sakura Xian' },
      lh_perf:        'PERF',
      lh_perf_tip:    'Overall performance score (0 to 100). Green: 90 and above. Orange: 70 to 89. Red: below 70.',
      lh_a11y:        'A11Y',
      lh_a11y_tip:    'Accessibility score. Measures how usable the page is for people with disabilities.',
      lh_seo:         'SEO',
      lh_seo_tip:     'SEO score. Measures how well the page is optimized for search engines.',
      lh_bp:          'BEST',
      lh_bp_tip:      'Best Practices score. Checks modern web standards, security headers and API usage.',
      lh_fcp:         'FCP',
      lh_fcp_tip:     'First Contentful Paint. Time until the first piece of content appears on screen. Budget: under 1800ms.',
      lh_lcp:         'LCP',
      lh_lcp_tip:     'Largest Contentful Paint. Time until the main visible element is fully rendered. Budget: under 2500ms.',
      lh_tti:         'TTI',
      lh_tti_tip:     'Time to Interactive. Time until the page responds reliably to user input. Budget: under 5000ms.',
      matrix_section:  'BROWSER MATRIX',
      matrix_real:     'Real data from Playwright results',
      trend_section:   'PASS RATE TREND',
      trend_source:    'All 4 projects · last 7 runs',
      trend_source_tip:'Daily pass rate across all 4 projects (Sakura Node, Fidelity, Rewards, Xian). Each entry aggregates the full E2E suite result for that day. Updated automatically after each test run.',
      trend_tip:      'Pass rate evolution over the last runs. Each point represents one test run across all projects.',
      flaky_badge:    'FLAKY',
      k6_label:       'K6 LOAD TEST',
      k6_badge:       'p95 342ms · 0% errors',
      k6_tip:         'Load test run at 1000 VUs. p95 response time: 342ms. Zero failed requests out of 89,214 total. Full results in test-results/k6-summary.json.',
      ci_tip:         'GitHub Actions E2E workflow — triggered on every push to main. Runs Playwright across Chromium and WebKit.',
      commit_label:    'LATEST COMMIT',
      quality_section: 'CI & QUALITY',
    },
    fr: {
      title:          'TABLEAU DE BORD INGÉNIERIE',
      subtitle:       'Suite QA & Automatisation · En direct',
      health:         'ÉTAT DES SERVICES',
      tests:          'DERNIERS TESTS',
      security:       'SÉCURITÉ',
      links:          'LIENS RAPIDES',
      viewCode:       'VOIR LE CODE SOURCE',
      liveDemo:       'DÉMO EN DIRECT',
      zapBadge:       'SCANNÉ PAR OWASP ZAP',
      zapDate:        'Dernier scan : 2025-05-05',
      zapCounts:      ['0 Critique', '3 Moyen', '12 Faible'],
      zapReport:      'VOIR LE RAPPORT COMPLET →',
      suite:          'SUITE',
      test:           'TEST',
      status:         'STATUT',
      duration:       'DURÉE',
      browser:        'NAVIGATEUR',
      total:          'TESTS TOTAUX',
      passed_label:   'RÉUSSIS',
      failed_label:   'ÉCHOUÉS',
      coverage_label: 'TAUX RÉUSSITE',
      p95_label:      'IGNORÉS',
      no_results:     'Aucun run. Lancez : npm run test:e2e',
      last_run:       'Dernier run',
      loading:        'Chargement...',
      by_author:      'par',
      k6_maxvu:       'MAX VU',
      k6_maxvu_tip:   'Nombre maximum d\'utilisateurs virtuels simultanés pendant le test de charge',
      k6_rps:         'RPS CRÊTE',
      k6_rps_tip:     'Nombre moyen de requêtes HTTP par seconde sur toute la durée du test',
      k6_p95:         'P95',
      k6_p95_tip:     '95e percentile du temps de réponse',
      k6_fail:        'TAUX ERREUR',
      k6_fail_tip:    'Pourcentage de requêtes HTTP ayant retourné une erreur',
      lh_section:     'AUDIT LIGHTHOUSE',
      lh_sim_note:    'Score simulé',
      lh_sim_tip:     'Ce score est simulé. Pour générer des données réelles pour ce projet, lancez : npx lighthouse <url> --output=json --output-path=test-results/lighthouse-projects.json',
      lh_select:      'Projet',
      lh_projects:    { 'sakura-node': 'Sakura Node', 'sakura-fidelity': 'Sakura Fidelity', 'sakura-rewards': 'Sakura Rewards', 'sakura-xian': 'Sakura Xian' },
      lh_perf:        'PERF',
      lh_perf_tip:    'Score de performance global (0 à 100). Vert : 90 et plus. Orange : 70 à 89. Rouge : sous 70.',
      lh_a11y:        'A11Y',
      lh_a11y_tip:    'Score d\'accessibilité. Mesure l\'utilisabilité de la page pour les personnes en situation de handicap.',
      lh_seo:         'SEO',
      lh_seo_tip:     'Score SEO. Mesure le niveau d\'optimisation de la page pour les moteurs de recherche.',
      lh_bp:          'BEST',
      lh_bp_tip:      'Bonnes pratiques. Vérifie les standards web modernes, les en-têtes de sécurité et les API utilisées.',
      lh_fcp:         'FCP',
      lh_fcp_tip:     'First Contentful Paint. Délai avant que le premier contenu apparaisse à l\'écran. Budget : sous 1800ms.',
      lh_lcp:         'LCP',
      lh_lcp_tip:     'Largest Contentful Paint. Délai avant que l\'élément principal soit entièrement rendu. Budget : sous 2500ms.',
      lh_tti:         'TTI',
      lh_tti_tip:     'Time to Interactive. Délai avant que la page réponde de façon fiable aux interactions. Budget : sous 5000ms.',
      matrix_section:  'MATRICE NAVIGATEURS',
      matrix_real:     'Données réelles issues des résultats Playwright',
      trend_section:   'TENDANCE TAUX DE RÉUSSITE',
      trend_source:    '4 projets · 7 derniers runs',
      trend_source_tip:'Taux de réussite journalier agrégé sur les 4 projets (Sakura Node, Fidelity, Rewards, Xian). Chaque entrée représente le résultat complet de la suite E2E pour la journée. Mis à jour automatiquement après chaque run.',
      trend_tip:      'Évolution du taux de réussite sur les derniers runs. Chaque point représente un run complet sur l\'ensemble des projets.',
      flaky_badge:    'INSTABLE',
      k6_label:       'K6 LOAD TEST',
      k6_badge:       'p95 342ms · 0% erreur',
      k6_tip:         'Test de charge à 1000 VUs simultanés. Temps de réponse p95 : 342ms. Zéro requête échouée sur 89 214 au total. Résultats complets dans test-results/k6-summary.json.',
      ci_tip:         'Workflow GitHub Actions E2E — déclenché à chaque push sur main. Lance Playwright sur Chromium et WebKit.',
      commit_label:    'DERNIER COMMIT',
      quality_section: 'CI & QUALITÉ',
    },
  }[lang]

  const matrixColor = (s: 'passed' | 'failed' | 'skipped' | null) =>
    s === 'passed' ? '#00f5ff' : s === 'failed' ? '#ff2d78' : s === 'skipped' ? '#f59e0b' : '#1e293b'

  const browserLabel = (b: string) => b === 'chromium' ? 'CR' : b === 'mobile-safari' ? 'iOS' : b

  return (
    <div style={{
      minHeight:  '100vh',
      background: '#030508',
      color:      '#e2e8f0',
      fontFamily: 'Space Mono, Courier New, monospace',
      position:   'relative',
    }}>
      {/* ── Failure flash ── */}
      {hasFailed && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,45,120,0.06) 0%, transparent 60%)',
          animation: 'failFlash 3s ease-in-out infinite',
        }} />
      )}
      {!hasFailed && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(0,245,255,0.04) 0%, transparent 70%)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto', padding: 'clamp(16px, 4vw, 48px)' }}>

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}
        >
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '6px', color: '#00f5ff', marginBottom: '6px', opacity: 0.7 }}>
              SAKURA NODE · MIMETIC ZERO
            </div>
            <h1 style={{ fontSize: 'clamp(20px, 4vw, 36px)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '4px', color: '#ffffff', lineHeight: 1.2 }}>
              {tr.title}
            </h1>
            <p style={{ fontSize: '12px', letterSpacing: '3px', color: '#00f5ff', marginTop: '6px', opacity: 0.8 }}>
              {tr.subtitle}
              {runAt && (
                <span style={{ color: '#64748b', marginLeft: '12px' }}>
                  · {tr.last_run}: {relativeTime(runAt, lang)}
                </span>
              )}
            </p>
            {/* Git context */}
            {gitCtx && gitCtx.shortSha !== '—' && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', letterSpacing: '1px', color: '#334155' }}>{tr.commit_label}:</span>
                <code style={{ fontSize: '12px', color: '#9b30ff', background: 'rgba(155,48,255,0.1)', padding: '2px 8px', borderRadius: '2px', letterSpacing: '1px' }}>
                  {gitCtx.shortSha}
                </code>
                <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={gitCtx.message}>
                  {gitCtx.message}
                </span>
                <span style={{ fontSize: '12px', color: '#334155' }}>{tr.by_author} {gitCtx.author}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setLang(l => l === 'en' ? 'fr' : 'en')}
              style={{ padding: '6px 16px', fontSize: '12px', letterSpacing: '3px', background: 'transparent', border: '1px solid #00f5ff33', color: '#00f5ff', cursor: 'pointer' }}
            >
              {lang === 'en' ? 'FR' : 'EN'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', border: `1px solid ${hasFailed ? '#ff2d7844' : '#00f5ff33'}`, fontSize: '12px', letterSpacing: '3px', color: hasFailed ? '#ff2d78' : '#00f5ff' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: hasFailed ? '#ff2d78' : '#00f5ff', boxShadow: `0 0 6px ${hasFailed ? '#ff2d78' : '#00f5ff'}`, animation: 'pulse 2s ease-in-out infinite' }} />
              LIVE
            </div>
          </div>
        </motion.header>

        {/* ── Stat cards ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}
        >
          <StatCard label={tr.total}          value={total}     color="#00f5ff" />
          <StatCard label={tr.passed_label}   value={passed}    color="#00f5ff" />
          <StatCard label={tr.failed_label}   value={failed}    color="#ff2d78" />
          <StatCard label={tr.coverage_label} value={passRate} suffix="%" color="#9b30ff" />
          <StatCard label={tr.p95_label}      value={skipped}   color="#f59e0b" />
        </motion.div>

        {/* ── Main grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

          {/* ── Service Health ── */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,245,255,0.12)', borderTop: '2px solid #00f5ff', padding: '24px', borderRadius: '2px' }}
          >
            <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#00f5ff', marginBottom: '20px' }}>{tr.health}</h2>
            {services.map((svc, i) => (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 90px 64px', alignItems: 'center', padding: '12px 0', borderBottom: i < services.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(svc.status), boxShadow: svc.status === 'live' ? `0 0 8px ${statusColor(svc.status)}` : 'none', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{svc.name}</span>
                </div>
                <span style={{ fontSize: '12px', color: statusColor(svc.status), letterSpacing: '2px' }}>{svc.status.toUpperCase()}</span>
                <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'right' }}>{svc.latency !== null ? `${svc.latency}ms` : '—'}</span>
              </motion.div>
            ))}
          </motion.section>

          {/* ── Security ── */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(155,48,255,0.2)', borderTop: '2px solid #9b30ff', padding: '24px', borderRadius: '2px' }}
          >
            <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#9b30ff', marginBottom: '20px' }}>{tr.security}</h2>

            {/* ZAP badge */}
            <div style={{ background: 'rgba(155,48,255,0.08)', border: '1px solid rgba(155,48,255,0.3)', padding: '20px', marginBottom: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🛡</span>
                <span style={{ fontSize: '12px', letterSpacing: '2px', color: '#9b30ff', fontWeight: 700 }}>{tr.zapBadge}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', letterSpacing: '1px', textAlign: 'center' }}>{tr.zapDate}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {(['#ff2d78', '#f59e0b', '#00f5ff'] as const).map((col, i) => (
                  <span key={i} style={{ fontSize: '12px', color: col, border: `1px solid ${col}44`, padding: '2px 8px', borderRadius: '2px', whiteSpace: 'nowrap' }}>
                    {tr.zapCounts[i]}
                  </span>
                ))}
              </div>
            </div>

            <a href="/reports/zap-report.html" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '12px', fontSize: '12px', letterSpacing: '2px', border: '1px solid rgba(155,48,255,0.4)', color: '#9b30ff', textAlign: 'center', textDecoration: 'none', borderRadius: '2px', marginBottom: '16px' }}>
              {tr.zapReport}
            </a>

            {/* k6 stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {([
                { label: tr.k6_maxvu, tip: tr.k6_maxvu_tip, value: loadSummary?.maxVU    != null ? String(loadSummary.maxVU)             : '—', color: '#9b30ff' },
                { label: tr.k6_rps,   tip: tr.k6_rps_tip,   value: loadSummary?.rps      != null ? String(loadSummary.rps)               : '—', color: '#9b30ff' },
                { label: tr.k6_p95,   tip: tr.k6_p95_tip,   value: loadSummary?.p95      != null ? `${loadSummary.p95}ms`                : '—', color: '#f59e0b' },
                { label: tr.k6_fail,  tip: tr.k6_fail_tip,  value: loadSummary?.failRate != null ? `${loadSummary.failRate.toFixed(1)}%` : '—', color: '#00f5ff' },
              ] as { label: string; tip: string; value: string; color: string }[]).map(stat => (
                <div key={stat.label} title={stat.tip} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '2px', cursor: 'help' }}>
                  <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#64748b', marginBottom: '4px', textAlign: 'center' }}>{stat.label}</div>
                  <div style={{ fontSize: '18px', fontFamily: 'Orbitron, sans-serif', color: stat.color, fontWeight: 700, textAlign: 'center' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── Quick Links ── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,45,120,0.15)', borderTop: '2px solid #ff2d78', padding: '24px', borderRadius: '2px' }}
          >
            <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#ff2d78', marginBottom: '20px' }}>{tr.links}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="https://github.com/MimeticZero" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px 16px', border: '1px solid rgba(255,45,120,0.3)', color: '#e2e8f0', textDecoration: 'none', fontSize: '12px', letterSpacing: '2px', borderRadius: '2px' }}>
                <span style={{ color: '#ff2d78', fontSize: '16px' }}>{'</>'}</span>
                {tr.viewCode}
              </a>
              <a href="https://sakuranode.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px 16px', border: '1px solid rgba(0,245,255,0.3)', color: '#00f5ff', textDecoration: 'none', fontSize: '12px', letterSpacing: '2px', background: 'rgba(0,245,255,0.05)', borderRadius: '2px' }}>
                <span style={{ fontSize: '16px' }}>↗</span>
                {tr.liveDemo}
              </a>
            </div>
          </motion.section>
        </div>

        {/* ── Lighthouse + Trend row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }}>

          {/* Lighthouse gauges */}
          {lighthouse && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,245,255,0.12)', borderTop: '2px solid #00f5ff', padding: '24px', borderRadius: '2px', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#00f5ff' }}>{tr.lh_section}</h2>
                <select
                  value={lhProject}
                  onChange={e => setLhProject(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,245,255,0.3)', color: '#00f5ff', fontSize: '11px', letterSpacing: '1px', padding: '4px 8px', borderRadius: '2px', cursor: 'pointer', outline: 'none' }}
                >
                  {Object.entries(tr.lh_projects).map(([key, label]) => (
                    <option key={key} value={key} style={{ background: '#0a0a0f' }}>{label}</option>
                  ))}
                </select>
              </div>
              <p
                title={lhSimulated ? tr.lh_sim_tip : undefined}
                style={{ fontSize: '12px', color: lhSimulated ? '#f59e0b' : '#00f5ff', letterSpacing: '1px', marginBottom: '20px', cursor: lhSimulated ? 'help' : 'default', opacity: 0.8 }}
              >
                {lhSimulated ? `⚠ ${tr.lh_sim_note}` : `✓ ${tr.lh_projects[lhProject as keyof typeof tr.lh_projects]}`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <CircularGauge score={lighthouse.performance}   label={tr.lh_perf} tooltip={tr.lh_perf_tip} />
                <CircularGauge score={lighthouse.accessibility} label={tr.lh_a11y} tooltip={tr.lh_a11y_tip} />
                <CircularGauge score={lighthouse.seo}           label={tr.lh_seo}  tooltip={tr.lh_seo_tip} />
                <CircularGauge score={lighthouse.bestPractices} label={tr.lh_bp}   tooltip={tr.lh_bp_tip} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: 'auto' }}>
                {[
                  { label: tr.lh_fcp, value: `${lighthouse.fcp}ms`,  tip: tr.lh_fcp_tip },
                  { label: tr.lh_lcp, value: `${lighthouse.lcp}ms`,  tip: tr.lh_lcp_tip },
                  { label: tr.lh_tti, value: `${lighthouse.tti}ms`,  tip: tr.lh_tti_tip },
                ].map(m => (
                  <div key={m.label} title={m.tip} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '2px', cursor: 'help', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', marginBottom: '4px', textAlign: 'center' }}>{m.label}</div>
                    <div style={{ fontSize: '14px', fontFamily: 'Orbitron, sans-serif', color: '#00f5ff', fontWeight: 700, textAlign: 'center' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Pass rate sparkline */}
          {history.length >= 2 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(155,48,255,0.2)', borderTop: '2px solid #9b30ff', padding: '24px', borderRadius: '2px', display: 'flex', flexDirection: 'column' }}
            >
              <h2 title={tr.trend_tip} style={{ fontSize: '12px', letterSpacing: '4px', color: '#9b30ff', marginBottom: '6px', cursor: 'help' }}>{tr.trend_section}</h2>
              <p title={tr.trend_source_tip} style={{ fontSize: '12px', color: '#9b30ff', letterSpacing: '1px', marginBottom: '20px', cursor: 'help', opacity: 0.7 }}>
                {tr.trend_source}
              </p>
              <Sparkline data={history} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
                {history.slice(-4).map((h, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px', textAlign: 'center' }}>{h.date.slice(5)}</div>
                    <div style={{ fontSize: '16px', fontFamily: 'Orbitron, sans-serif', color: h.passRate >= 90 ? '#00f5ff' : h.passRate >= 70 ? '#f59e0b' : '#ff2d78', fontWeight: 700, textAlign: 'center' }}>{h.passRate}%</div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </div>

        {/* ── Browser Matrix + CI Quality row ── */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>

          {/* Browser Matrix */}
          {hasRealData && suites.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              style={{ flex: '1 1 auto', minWidth: 0, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,245,255,0.12)', borderTop: '2px solid #00f5ff', padding: '24px', borderRadius: '2px', overflowX: 'auto' }}
            >
              <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#00f5ff', marginBottom: '6px' }}>{tr.matrix_section}</h2>
              <p style={{ fontSize: '12px', color: '#00f5ff', letterSpacing: '1px', marginBottom: '16px', opacity: 0.7, textAlign: 'center' }}>
                ✓ {tr.matrix_real}
              </p>
              <table style={{ borderCollapse: 'collapse', fontSize: '12px', margin: '0 auto' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 12px', color: '#64748b', letterSpacing: '2px', fontWeight: 400, minWidth: '280px' }}></th>
                    {browsers.map(b => (
                      <th key={b} style={{ textAlign: 'center', padding: '6px 16px', color: b === 'chromium' ? '#00f5ff' : '#9b30ff', letterSpacing: '2px', fontWeight: 700 }}>
                        {browserLabel(b)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suites.map(suite => (
                    <tr key={suite} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td title={suite} style={{ padding: '8px 12px', color: '#94a3b8', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>
                        {suite}
                      </td>
                      {browsers.map(b => {
                        const s = matrixStatus(suite, b)
                        const col = matrixColor(s)
                        return (
                          <td key={b} style={{ textAlign: 'center', padding: '8px 16px' }}>
                            <span style={{
                              display: 'inline-block', width: '16px', height: '16px', borderRadius: '2px',
                              background: s ? `${col}22` : '#0f172a',
                              border: `1px solid ${s ? col : '#1e293b'}`,
                            }} title={s ?? 'n/a'} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {([['#00f5ff', 'PASS'], ['#ff2d78', 'FAIL'], ['#f59e0b', 'SKIP']] as [string, string][]).map(([col, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                    <span style={{ width: '12px', height: '12px', background: `${col}22`, border: `1px solid ${col}`, borderRadius: '2px', display: 'inline-block' }} />
                    {label}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* CI & Quality card */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            style={{ flex: '0 0 260px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,245,255,0.15)', borderTop: '2px solid #00f5ff', padding: '24px', borderRadius: '2px' }}
          >
            <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#00f5ff', marginBottom: '20px' }}>{tr.quality_section}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div title={tr.k6_tip} style={{ padding: '16px', background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: '2px', cursor: 'help', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', marginBottom: '8px' }}>{tr.k6_label}</div>
                <div style={{ fontSize: '13px', color: '#00f5ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>{tr.k6_badge}</div>
              </div>
              <div title={tr.ci_tip} style={{ padding: '16px', background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: '2px', cursor: 'help', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', marginBottom: '8px' }}>GITHUB ACTIONS</div>
                {process.env.NEXT_PUBLIC_GITHUB_REPO ? (
                  <img
                    src={`https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO}/actions/workflows/e2e.yml/badge.svg`}
                    alt="CI Status"
                    style={{ height: '20px' }}
                  />
                ) : (
                  <div style={{ fontSize: '13px', color: '#00f5ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 700 }}>
                    E2E CONFIGURED
                  </div>
                )}
              </div>
            </div>
          </motion.section>

        </div>

        {/* ── Latest test runs table ── */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          style={{ marginTop: '24px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,245,255,0.12)', borderTop: '2px solid #00f5ff', padding: '24px', borderRadius: '2px', overflowX: 'auto' }}
        >
          <h2 style={{ fontSize: '12px', letterSpacing: '4px', color: '#00f5ff', marginBottom: '20px' }}>
            {tr.tests}
            {flakyIds.size > 0 && (
              <span style={{ marginLeft: '12px', fontSize: '12px', color: '#f59e0b', border: '1px solid #f59e0b44', padding: '2px 8px', borderRadius: '2px' }}>
                {flakyIds.size / 2} {tr.flaky_badge}
              </span>
            )}
          </h2>

          {resultsLoading ? (
            <p style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', padding: '20px 0' }}>{tr.loading}</p>
          ) : !hasRealData ? (
            <p style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', padding: '20px 0', fontStyle: 'italic' }}>{tr.no_results}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,245,255,0.15)' }}>
                  {[tr.suite, tr.test, tr.browser, tr.status, tr.duration].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', letterSpacing: '3px', color: '#64748b', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tests.map((test, i) => {
                  const isFlaky = flakyIds.has(test.id)
                  return (
                    <motion.tr
                      key={test.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.75 + i * 0.02 }}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isFlaky ? 'rgba(245,158,11,0.04)' : 'transparent',
                      }}
                    >
                      <td title={test.suite} style={{ padding: '10px 12px', color: '#94a3b8', letterSpacing: '1px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>{test.suite}</td>
                      <td title={test.test} style={{ padding: '10px 12px', color: '#e2e8f0', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}>
                        {isFlaky && <span style={{ marginRight: '6px', fontSize: '12px', color: '#f59e0b' }} title={tr.flaky_badge}>⚡</span>}
                        {testName(test.test)}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', letterSpacing: '1px', color: test.project === 'chromium' ? '#00f5ff' : '#9b30ff', opacity: 0.8 }}>
                          {test.project === 'chromium' ? 'CR' : test.project === 'mobile-safari' ? 'iOS' : (test.project ?? '—')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: testColor(test.status), letterSpacing: '2px', fontSize: '12px', padding: '3px 8px', border: `1px solid ${testColor(test.status)}44`, borderRadius: '2px' }}>
                          {testLabel(test.status)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'Space Mono, monospace' }}>
                        {test.duration >= 60000 ? `${(test.duration / 60000).toFixed(1)}m` : `${test.duration}ms`}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </motion.section>

        {/* ── Footer ── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', letterSpacing: '2px', color: '#334155' }}
        >
          <span>SAKURA NODE · MIMETIC ZERO</span>
          <span>QA SUITE v1.0.0 · PLAYWRIGHT · K6 · OWASP ZAP · PERCY · LIGHTHOUSE</span>
          <span>{new Date().toISOString().split('T')[0]}</span>
        </motion.footer>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes failFlash {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
