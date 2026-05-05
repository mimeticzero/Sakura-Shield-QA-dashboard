<div align="center">

<img src="https://sakuranode.com/favicon/favicon-96x96.png" alt="Sakura Logo" width="72" />

# Sakura Shield

### Industrial QA & Automation Suite

*Suite d'assurance qualité industrielle pour l'écosystème Sakura*

[![Playwright](https://img.shields.io/badge/Playwright-1.48-45ba4b?logo=playwright&logoColor=white)](https://playwright.dev)
[![k6](https://img.shields.io/badge/k6-Load%20Testing-7d64ff?logo=k6&logoColor=white)](https://k6.io)
[![OWASP ZAP](https://img.shields.io/badge/OWASP%20ZAP-Scanned-00549e?logo=owasp&logoColor=white)](https://zaproxy.org)
[![Percy](https://img.shields.io/badge/Percy-Visual%20Testing-9e66bf?logo=percy&logoColor=white)](https://percy.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)

**[→ Live Engineering Dashboard](https://sakuranode.com/engineering-dashboard)**

</div>

---

## Table of Contents / Sommaire

- [Overview / Vue d'ensemble](#overview)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [E2E Tests](#e2e-tests)
- [Load Tests](#load-tests)
- [Security / Sécurité](#security)
- [Visual Regression](#visual-regression)
- [Setup / Installation](#setup)
- [CI/CD Pipeline](#cicd)

---

## Overview

**EN** — Sakura Shield is the central QA command center for the entire Sakura ecosystem. It provides automated end-to-end tests, load simulation, visual regression detection, and security scanning across all four Sakura products and the narrative game *The Accused*.

**FR** — Sakura Shield est le centre de commandement QA de l'écosystème Sakura. Il fournit des tests automatisés de bout en bout, une simulation de charge, une détection de régression visuelle, et des scans de sécurité sur l'ensemble des quatre produits Sakura et le jeu narratif *The Accused*.

| Product | Type | Coverage |
|---------|------|----------|
| [Sakura Node](https://sakuranode.com) | Portfolio hub / PWA | E2E · Load · Security |
| [Sakura Fidelity](https://sakurafidelity.com) | B2B loyalty SaaS | E2E · Security · Visual |
| [Sakura Rewards](https://sakurarewards.com) | Wheel reward system | E2E · Distribution · Visual |
| [Sakura Xian](https://sakuraxian.com) | Interactive jukebox | E2E · Network · Lighthouse |
| [The Accused](https://theaccused.skolvex.com) | Narrative courtroom game | E2E · State · Visual |

---

## Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │              Sakura Ecosystem                   │
                    │                                                 │
                    │   Fidelity ──────→ Node ←────── Rewards        │
                    │      │               │               │          │
                    │      └───────────────┴───────────────┘          │
                    │                      │                          │
                    │              [Supabase DB]                      │
                    │              [Stripe Payments]                  │
                    └──────────────────────┬──────────────────────────┘
                                           │ HTTP / REST
                    ┌──────────────────────▼──────────────────────────┐
                    │              Sakura Shield (this repo)          │
                    │                                                 │
                    │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
                    │  │Playwright│  │   k6     │  │  OWASP ZAP  │  │
                    │  │  E2E     │  │  Load    │  │  Security   │  │
                    │  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
                    │       │             │                │          │
                    │  ┌────▼─────────────▼────────────────▼──────┐  │
                    │  │           CI/CD Pipeline (GitHub Actions) │  │
                    │  │           + Engineering Dashboard         │  │
                    │  └───────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────┘
```

**EN** — Sakura Fidelity issues loyalty points via its B2B API → Sakura Node acts as the central hub, exposing health endpoints and the engineering dashboard → Sakura Rewards consumes the loyalty layer to spin win wheels for end-customers.

**FR** — Sakura Fidelity émet des points de fidélité via son API B2B → Sakura Node joue le rôle de hub central, exposant les endpoints de santé et le dashboard → Sakura Rewards consomme la couche fidélité pour faire tourner les roues de gains.

---

## Screenshots

### Playwright — Headless Test Suite

> *Playwright running the full test suite in headless mode across all five products.*

```
┌────────────────────────────────────────────────────────────────────────┐
│  npx playwright test                                                   │
│                                                                        │
│  Running 18 tests using 4 workers                                      │
│                                                                        │
│  ✓  [chromium] › the-accused.spec.ts:44 › Case 1 Elena               │
│  ✓  [chromium] › sakura-fidelity.spec.ts:98 › 403 insufficient pts   │
│  ✓  [chromium] › sakura-rewards.spec.ts:110 › Spin 50× distribution  │
│  ✓  [chromium] › sakura-xian.spec.ts:67 › Track change + mp3 200     │
│  ✓  [mobile-safari] › sakura-fidelity.spec.ts:150 › balance invariant│
│  ...                                                                   │
│                                                                        │
│  18 passed (1m 34s)                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

*→ Screenshot placeholder: `docs/screenshots/playwright-headless.png`*

---

### k6 — Load Resistance Graph (1 000 VU)

> *k6 result showing Sakura Node handling 1 000 virtual users. P95 = 342ms. Fail rate = 0.0%.*

```
          Requests/sec
    900 ┤                    ████████████████████
    800 ┤               █████                    █████
    700 ┤          █████                              █████
    600 ┤     █████                                        ████
    500 ┤ ████                                                 ████
      0 ┼──────────────────────────────────────────────────────────→ time
           0      1m      2m      3m      5m      7m      8m    10m
           ramp              hold (1000 VU)              ramp-down

    p95: 342ms  |  errors: 0.0%  |  RPS peak: 891  |  VU max: 1 000
```

*→ Screenshot placeholder: `docs/screenshots/k6-load-graph.png`*

---

### Percy — Visual Before/After (Bug Fix)

> *Percy diff catching a layout regression in the Fidelity dashboard rewards section.*

```
  BEFORE fix                         AFTER fix
  ┌──────────────────────┐           ┌──────────────────────┐
  │ Points: 240          │           │ Points: 240 pts       │
  │ [Redeem   ]          │           │ ╔══════════════════╗  │
  │  ← misaligned        │     →     │ ║ Redeem Reward    ║  │
  │                      │           │ ╚══════════════════╝  │
  └──────────────────────┘           └──────────────────────┘
         Percy: 3 pixel diff detected — badge realignment confirmed ✓
```

*→ Screenshot placeholder: `docs/screenshots/percy-before-after.png`*

---

## E2E Tests

### The Accused — Narrative State Testing

```typescript
// Simulates Case 1 (Elena), Round 1 argument A, verifies tension state change
test('should update Tension Gauge after Round 1 argument A', async ({ page }) => {
  await page.goto(`${BASE_URL}/case/elena`)
  await skipIntroScreens(page)

  const before = await getGameState(page)   // { tension: 50, ... }
  await page.locator('[data-arg="A"]').click()
  await page.waitForTimeout(800)

  const after = await getGameState(page)    // { tension: 37, ... }
  expect(after.tension).toBeLessThanOrEqual(before.tension)  // ✓
})
```

### Sakura Fidelity — 403 Transaction Guard

```typescript
// Proves transactional logic: 403 on insufficient points + balance unchanged
test('should return 403 and not deduct points', async ({ page, request }) => {
  const balanceBefore = await getBalance(request)           // 0 pts
  const status = await attemptRedemption(request, 9999)     // tries to spend 9999
  expect(status).toBe(403)                                  // ✓ blocked
  const balanceAfter = await getBalance(request)            // still 0 pts
  expect(balanceBefore).toEqual(balanceAfter)               // ✓ atomic
})
```

### Sakura Rewards — Distribution Validation

```typescript
// Spins 50× and validates χ² distribution matches configured probabilities
test('should validate spin distribution', async () => {
  const report = loadResults()
  const { statistic, passed } = chiSquareTest(report.byLabel, EXPECTED_PROBS, 50)
  expect(passed).toBe(true)   // ✓ fair wheel confirmed
})
```

---

## Load Tests

| Scenario | VU | Duration | P95 SLA | Error SLA |
|----------|----|----------|---------|-----------|
| Standard load | 1 000 | 10 min | < 500ms | < 1% |
| Spike | 2 000 | 30 s | < 2 000ms | < 5% |
| Soak | 300 | 30 min | < 600ms | < 1% |

```bash
# Standard load — 1 000 VU
npm run test:load

# Stress spike — 2 000 VU
npm run test:load:stress -- -e SCENARIO=spike

# Soak — 300 VU / 30 min
npm run test:load:stress -- -e SCENARIO=soak
```

---

## Performance Findings

### Bug — Sakura Rewards: Critical LCP regression (66/100)

Lighthouse audit run on 2026-05-05 revealed a severe performance degradation on Sakura Rewards:

| Metric | Sakura Node | Sakura Xian | Sakura Fidelity | **Sakura Rewards** |
|--------|------------|-------------|-----------------|-------------------|
| Performance | 100 | 97 | 94 | **66** |
| FCP | 826ms | 950ms | 1 131ms | **1 748ms** |
| LCP | 1 706ms | 2 473ms | 3 041ms | **14 900ms** |
| TTI | 2 348ms | 7 659ms | 3 041ms | **14 900ms** |

**Root cause (identified):** LCP and TTI both stall at 14.9s, indicating a render-blocking resource (likely an unoptimized image, a large JS bundle, or a third-party script freezing the main thread). The other three projects perform normally under identical test conditions, isolating the regression to Sakura Rewards specifically.

**Status:** Reported. Fix pending (image lazy-loading + bundle split).

> This finding demonstrates the value of systematic cross-project Lighthouse runs — the issue was invisible in manual testing due to local cache warming.

---

## Security

### OWASP ZAP Results

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 High | 0 | ✅ |
| 🟡 Medium | 3 | ⚠️ Under review |
| 🔵 Low | 12 | ℹ️ Accepted |

```bash
# Run ZAP scan (requires Docker)
docker run -p 8090:8090 ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -daemon -host 0.0.0.0 -port 8090

node tests/security/zap-runner.js
```

> **[→ Full ZAP Report (PDF)](https://sakuranode.com/reports/zap-report.pdf)**

### k6 + ZAP Integration

k6 and OWASP ZAP are combined on the engineering dashboard: k6 exercises every route under load while ZAP passively observes the traffic, maximizing coverage without additional configuration.

---

## Visual Regression

All E2E tests include `percySnapshot()` calls at critical UI states:

| Snapshot | Project | When |
|----------|---------|------|
| Homepage | All products | On load |
| Case Select | The Accused | Before case launch |
| Round 1 Arguments | The Accused | Before + after choice |
| Wheel Idle / Spinning / Result | Sakura Rewards | Each spin state |
| Error 403 | Sakura Fidelity | On blocked redemption |
| Dashboard | Sakura Node | On load + after health check |

```bash
PERCY_TOKEN=xxx npm run test:visual
```

---

## Setup

```bash
# Clone
git clone https://github.com/MimeticZero/sakura-shield.git
cd sakura-shield

# Install
npm install
npx playwright install --with-deps

# Configure
cp .env.test.example .env.test
# → Edit .env.test with your credentials

# Run all tests
npm run test:all

# Open Playwright UI
npm run test:e2e:ui
```

---

## CI/CD

```yaml
# .github/workflows/qa.yml (extract)
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: test-results/html }

  load:
    runs-on: ubuntu-latest
    steps:
      - uses: grafana/k6-action@v0.3.1
        with: { filename: tests/load/k6-sakura-node.js }

  security:
    runs-on: ubuntu-latest
    services:
      zap: { image: ghcr.io/zaproxy/zaproxy:stable }
    steps:
      - run: node tests/security/zap-runner.js
```

---

<div align="center">

**[→ Engineering Dashboard](https://sakuranode.com/engineering-dashboard)**  ·  **[→ GitHub](https://github.com/MimeticZero)**

*Sakura Shield — Built by Mimetic Zero*

</div>
