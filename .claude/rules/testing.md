# Testing

## What to test, where

**Unit tests (Vitest)** — pure functions, Zod schemas, template rendering, business logic inside `server/services/`, and each adapter implementation individually. Fast. No I/O. No network.

**Integration tests (Vitest + test Postgres)** — server actions and API routes exercising real Drizzle queries against a local Postgres. Each test wraps work in a transaction and rolls back.

**Generator tests (Vitest, sandboxed)** — the most important category in this product. For every template variant:
1. Render the template with a representative config
2. Install dependencies in a tmp directory
3. Run the generated project's `build` and `test` scripts
4. Assert the server boots

A failing generator test = a template change that broke the product. Treat it like a P0.

**E2E tests (Playwright)** — only the critical user flows:
- Fill the generator form → preview code → download ZIP
- Choose Python + FastAPI-MCP variant → output contains expected files (`main.py`, `FastApiMCP(app)` wiring, `requirements.txt` includes `fastapi-mcp`)
- Wizard validation errors block submission

E2E coverage for auth and billing is deferred until those exist.

## Coverage expectations per PR
- New function in `server/services/` → unit tests
- New API route or server action → integration test
- New template variant → generator test (render + boot)
- New adapter implementation → unit tests for that adapter alone
- New consumer of an adapter → integration test using the active in-memory/noop adapter
- UI components: tests only if they contain non-trivial logic

Track coverage but don't gate on a number — gate on these rules.

## Mocking
- External HTTP: MSW handlers in `tests/msw/`
- Time: `vi.useFakeTimers()` for anything date-sensitive
- Auth: tests use the noop adapter (already the POC default)
- Storage: tests use the local adapter pointed at a temp dir
- Rate limit: tests use the in-memory adapter with a fresh instance per test
- Never mock Drizzle — always use the real test DB

## Test data
- Factories in `tests/factories/` using `@faker-js/faker`
- Each test creates its own data; no shared fixtures across tests
- No `.skip` or `.only` in committed code (lint rule enforces)

## Running tests
- `pnpm test` — unit + integration, watch off
- `pnpm test:watch` — local development
- `pnpm test:generator` — full render + boot for every template, slow, CI-only by default
- `pnpm test:e2e` — Playwright, requires `pnpm dev` running locally
- CI runs all four on every PR

## Flaky test policy
One fix attempt. If the test flakes again within 7 days, delete it and open an issue describing what it was meant to catch. We do not retry-loop in CI.

## When debugging a failing test
Fix the code, not the test. If the test is genuinely wrong, write a comment explaining why before changing it. Never delete an assertion to make a test pass.