# MCP Tool Generator — Project Brain

## What this is
A web app where engineers fill out a form describing an MCP (Model Context
Protocol) tool and receive a production-ready scaffold. Generates:
- **TypeScript** servers using `@modelcontextprotocol/sdk`
- **Python (FastMCP)** servers using the official Python SDK
- **Python (FastAPI-MCP)** servers using `fastapi-mcp` to auto-expose
  existing FastAPI endpoints as MCP tools

## Project stage: POC
This is a proof of concept. The hero flow is: fill the wizard → preview
code → download ZIP → the generated server boots in under 2 minutes.

Auth and billing are **out of scope for the POC**, but the architecture
preserves the seams so they can be wired up later without rewrites.

## Phase
Currently: **Phase 0 (foundation)**. See `docs/SPEC.md` for the full plan.
Do not skip ahead. Each phase has a hard "done" definition.

## Stack (locked — see `.claude/rules/stack.md`)
Next.js 15 App Router + TS strict, Tailwind v4 + shadcn/ui, Drizzle + Neon
Postgres, Vercel hosting, pnpm. No auth provider, no billing.

## Adapters: build the seams, not the integration
Three adapter interfaces ship with no-op / in-memory defaults in the POC.
Stub implementations of the real providers exist but are NOT wired in:

- **AuthAdapter** — `NoopAuthAdapter` (active) returns a fixed dev user;
  `OktaAuthAdapter` and `EntraAuthAdapter` stubs in `lib/auth/adapters/`
- **StorageAdapter** — `LocalAdapter` (active) writes to `.artifacts/`;
  `R2Adapter` stub in `lib/storage/adapters/`
- **RateLimitAdapter** — `InMemoryAdapter` (active); `UpstashAdapter` stub
  in `lib/rate-limit/adapters/`

Never bypass an adapter interface, even though the defaults are trivial.
That's what makes Okta or Entra a one-file swap later.

## How to work with me
- Read `docs/SPEC.md` and the relevant `.claude/rules/*.md` before non-trivial work
- For any feature: propose a plan first, wait for approval, then implement
- Tests before features in each phase. Vitest for unit, Playwright for e2e
- After changes that touch >3 files, run `pnpm typecheck && pnpm test`
- Never commit secrets. Never disable a test to make CI green
- Architectural decisions get an ADR in `docs/adr/` before code

## Commands
- `pnpm dev` | `pnpm build` | `pnpm test` | `pnpm typecheck` | `pnpm lint`
- `pnpm db:push` | `pnpm db:studio`
- `pnpm test:generator` (renders every template and boots the output)