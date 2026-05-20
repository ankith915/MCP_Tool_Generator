# Stack — Locked Decisions

These are not suggestions. Do not introduce alternatives without an ADR
in `docs/adr/`. This is a POC; some choices are deliberately deferred
(auth, billing), but the seams for them are present and enforced.

## Runtime & language
- Node.js 20 LTS
- TypeScript 5.6+ with `"strict": true` and `"noUncheckedIndexedAccess": true`
- pnpm 9+ (never npm, never yarn in this repo)

## Framework
- Next.js 15+, App Router only (no `pages/` directory)
- React 19
- Server Components by default; mark client components with `"use client"`

## Styling & UI
- Tailwind CSS v4
- shadcn/ui — copy components into `components/ui/`, do not install as a package
- Lucide React for icons
- Sonner for toasts
- Monaco Editor via `@monaco-editor/react` for in-app code preview
- Do NOT install: chakra-ui, mui, mantine, ant-design, daisyui, headlessui, codemirror, ace

## Data
- Postgres via Neon, serverless driver `@neondatabase/serverless`
- Drizzle ORM (NOT Prisma, NOT TypeORM, NOT raw `pg` in app code)
- Drizzle Kit for migrations (`pnpm db:generate`, `pnpm db:push`)
- Schema in `db/schema/*.ts`, one file per logical domain

## Auth — POC stance + adapter pattern
The POC ships with **no real auth**. But the seams are mandatory now.

Required structure under `lib/auth/`:
```
lib/auth/
  types.ts                # AuthAdapter interface, User type
  index.ts                # exports the active adapter, chosen by AUTH_PROVIDER env var
  adapters/
    noop.ts               # ACTIVE — returns a fixed dev user
    okta.ts               # stub, throws "not implemented" — do not wire up
    entra.ts              # stub, throws "not implemented" — do not wire up
```

Rules:
- Every route that would need auth still calls `getCurrentUser()` from `lib/auth/`
- Never import an adapter directly outside `lib/auth/adapters/`
- Do NOT install: `@workos-inc/node`, `@clerk/nextjs`, `next-auth`, `lucia`, `iron-session`
- Wiring up Okta or Entra is a post-POC ADR, not a casual change

## Billing
- **Out of scope for the POC.** Do NOT install Stripe, Paddle, Lemon Squeezy, Polar
- Do NOT add billing tables to the schema
- Pricing pages, plans, usage metering — all deferred

## Storage (for generated ZIPs)
Adapter pattern under `lib/storage/`:
```
lib/storage/
  types.ts                # StorageAdapter interface
  index.ts                # exports the active adapter
  adapters/
    local.ts              # ACTIVE — writes to .artifacts/, gitignored
    r2.ts                 # stub for Cloudflare R2 — not wired
```

## Rate limiting
Adapter pattern under `lib/rate-limit/`:
```
lib/rate-limit/
  types.ts                # RateLimitAdapter interface
  index.ts                # exports the active adapter
  adapters/
    memory.ts             # ACTIVE — Map-based with TTL, in-process
    upstash.ts            # stub — not wired
```
POC still rate-limits `/api/v1/generate` (in memory) to prevent accidental loops.

## Forms & validation
- React Hook Form for form state
- Zod for schemas; every server action and API route validates input with Zod
- The same Zod schema is reused on client and server in `lib/schemas/*.ts`

## Template rendering (the product's core)
- eta v3 for templating generator output
- Templates live in `templates/<language>/<framework>/<transport>/`
- Never build template output via string interpolation or regex outside eta

## Observability
- POC: Pino logging to stdout is sufficient
- Sentry / PostHog deferred — do NOT install yet
- The logger interface in `lib/logger.ts` is vendor-agnostic so vendors swap cleanly later

## Testing
- Vitest for unit and integration
- Playwright for e2e
- MSW for HTTP mocking
- Not Jest, not Cypress, not Mocha

## Hosting
- App on Vercel
- POC artifacts in the local filesystem (`.artifacts/`); R2 swap is post-POC

---

## What we GENERATE (the product's output stack)

### TypeScript template
- `@modelcontextprotocol/sdk` (pinned exact version)
- Zod for tool input validation
- Pino for structured logging
- Hono for HTTP (Streamable HTTP transport variants)
- Vitest for tests in the generated project

### Python templates — two variants
The wizard asks: *"Do you have an existing FastAPI service to attach MCP to?"*

**Variant A — FastMCP (default Python option)**
- Official `mcp` Python SDK with `FastMCP`
- Pydantic for tool input validation
- structlog for logging
- pytest for tests in the generated project

**Variant B — FastAPI-MCP**
- `fastapi-mcp` library (auto-exposes FastAPI endpoints as MCP tools)
- Generates a FastAPI app with MCP wired up via `FastApiMCP(app)`
- Pydantic models already define schemas; MCP tool definitions derive from them
- Pick this when the team already runs FastAPI in production

Both Python variants support Streamable HTTP and stdio transports.

## Version pinning
- Pin exact versions (no `^`, no `~`) for: `next`, `react`, `drizzle-orm`, `zod`, and `@modelcontextprotocol/sdk` (the version used in TS templates)
- Other packages: caret ranges OK
- Renovate config deferred to post-POC

## Adding a new dependency
1. Check if an installed dep already does it
2. Verify license: MIT / Apache-2.0 / BSD / ISC only
3. Verify maintenance: >1 maintainer, released in last 12 months, >1k weekly downloads
4. If runtime dep: add a one-line note in the relevant ADR