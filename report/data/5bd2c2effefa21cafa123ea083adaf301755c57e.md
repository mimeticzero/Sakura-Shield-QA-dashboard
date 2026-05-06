# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/rewards.api.spec.ts >> Rewards API — Replay protection >> POST /api/spin replayed token returns 409 or 403 (idempotency guard)
- Location: tests/e2e/api/rewards.api.spec.ts:252:7

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:3000
Call log:
  - → POST http://localhost:3000/api/spin
    - user-agent: Playwright/1.59.1 (x64; ubuntu 24.04) node/20.20 CI/1
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Content-Type: application/json
    - content-length: 12

```