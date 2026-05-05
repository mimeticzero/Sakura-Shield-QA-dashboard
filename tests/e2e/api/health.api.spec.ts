/**
 * Sakura Shield — Health Contract Tests (API only, no browser)
 * FR: Tests de contrat sur les endpoints de santé — aucun navigateur requis.
 *     Vérifie que chaque service Sakura répond correctement (200, headers, latence).
 * EN: Health contract tests — no browser required.
 *     Verifies every Sakura service responds correctly (200, headers, latency).
 *
 * Why this matters / Pourquoi c'est important :
 *   Health checks are the first line of defence in any monitoring strategy.
 *   A broken health endpoint means alerts fire late and on-call engineers
 *   debug blind. These tests guarantee the contract holds before E2E even runs.
 *
 *   Les health checks sont la première ligne de défense de toute stratégie de
 *   monitoring. Un endpoint cassé retarde les alertes et aveugle les ingénieurs
 *   d'astreinte. Ces tests garantissent que le contrat tient avant même l'E2E.
 */

import { test, expect } from '@playwright/test'

// ── Service registry ─────────────────────────────────────────────────────

const SERVICES = [
  {
    name:    'Sakura Node',
    url:     process.env.SAKURA_NODE_URL ?? 'https://sakuranode.com',
    timeout: 5_000,
  },
  {
    name:    'Sakura Fidelity',
    url:     process.env.FIDELITY_URL ?? 'https://sakurafidelity.com',
    timeout: 5_000,
  },
  {
    name:    'Sakura Rewards',
    url:     process.env.REWARDS_URL ?? 'https://sakurarewards.com',
    timeout: 6_000,   // slightly longer — known LCP regression
  },
  {
    name:    'Sakura Xian',
    url:     process.env.XIAN_URL ?? 'https://sakuraxian.com',
    timeout: 5_000,
  },
] as const

const SLA_MS = 3_000   // maximum acceptable response time

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Health Contract Tests', () => {

  for (const service of SERVICES) {

    test(`${service.name} — homepage returns HTTP 200`, async ({ request }) => {
      /**
       * FR: Vérifie que la page d'accueil répond avec un code 200.
       * EN: Asserts the homepage responds with HTTP 200.
       */
      const start = Date.now()
      const res   = await request.get(service.url, {
        timeout: service.timeout,
        headers: { 'Accept': 'text/html' },
      })
      const elapsed = Date.now() - start

      expect(res.status(),
        `${service.name} should return 200, got ${res.status()}`)
        .toBe(200)

      expect(elapsed,
        `${service.name} responded in ${elapsed}ms, SLA is ${SLA_MS}ms`)
        .toBeLessThan(SLA_MS)
    })

    test(`${service.name} — response has content-type header`, async ({ request }) => {
      /**
       * FR: Vérifie la présence du header Content-Type dans la réponse.
       * EN: Asserts Content-Type header is present in the response.
       */
      const res = await request.get(service.url, { timeout: service.timeout })
      const ct  = res.headers()['content-type'] ?? ''

      expect(ct,
        `${service.name} should return a content-type header`)
        .toBeTruthy()
    })

  }

  test('All services — none returns 5xx error', async ({ request }) => {
    /**
     * FR: Aucun service ne doit retourner une erreur serveur (5xx).
     * EN: No service should return a server-side error (5xx).
     */
    const results = await Promise.all(
      SERVICES.map(async (s) => ({
        name:   s.name,
        status: (await request.get(s.url, { timeout: s.timeout })).status(),
      }))
    )

    for (const { name, status } of results) {
      expect(status,
        `${name} returned ${status} — 5xx server error detected`)
        .toBeLessThan(500)
    }
  })

  test('All services — respond within SLA concurrently', async ({ request }) => {
    /**
     * FR: Vérifie que tous les services répondent dans les délais SLA
     *     lorsqu'ils sont interrogés en parallèle (simule le monitoring réel).
     * EN: Asserts all services respond within SLA when queried in parallel
     *     (simulates real-world monitoring behaviour).
     */
    const start   = Date.now()
    const results = await Promise.all(
      SERVICES.map(s => request.get(s.url, { timeout: s.timeout }))
    )
    const elapsed = Date.now() - start

    // All succeeded
    for (let i = 0; i < results.length; i++) {
      expect(results[i].status()).toBeLessThan(500)
    }

    // Concurrent wall-clock time should be close to the slowest single request
    expect(elapsed,
      `Concurrent health check took ${elapsed}ms — possible cascading slowness`)
      .toBeLessThan(SLA_MS + 2_000)
  })

})
