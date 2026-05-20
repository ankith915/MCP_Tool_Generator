# ADR 0001 — Stack Choice

Date: 2026-05-20
Status: Accepted

## Context
We are building a web-based MCP Tool Generator as a POC. We need a framework
and toolchain that a TypeScript team already knows, that deploys easily on
Vercel, that keeps the door open for post-POC enhancements (auth, billing,
storage), and that lets us generate code from templates without a heavy build
pipeline.

## Decision
We adopt the following locked stack:

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable, Vercel-native |
| Language | TypeScript 5.6+ strict | Safety without overhead at POC scale |
| Framework | Next.js 15 App Router | Server Components + API routes in one repo |
| UI | Tailwind v4 + shadcn/ui | No style debt, composable primitives |
| DB | Drizzle + Neon (serverless) | Type-safe queries, no connection pool overhead |
| Forms | React Hook Form + Zod | Shared schema for client and server validation |
| Templates | eta v3 | Lightweight, logic-capable, no new runtime |
| Tests | Vitest + Playwright | Fast unit/integration; real browser e2e |
| Hosting | Vercel | Zero-config deploys from main |
| Package manager | pnpm 9+ | Strict, fast, avoids phantom deps |

## Alternatives considered
- **T3 stack** — opinionated and helpful, but adds tRPC which is unnecessary
  friction when we're exposing a public generator API via REST.
- **Remix** — file-based routing is fine, but team familiarity and Vercel
  integration tip the balance to Next.js.
- **Prisma** — heavier migration story than Drizzle; Drizzle's type inference
  is better suited to a strict TS codebase.
- **NextAuth / Lucia** — deferred entirely; the adapter pattern means we do
  not need an auth library choice yet.

## Consequences
- All new dependencies must pass the license + maintenance gate in `stack.md`.
- Pages directory is forbidden; App Router only.
- Drizzle is the only way in or out of the database — no raw `pg` queries in
  app code.
- Version pinning rules apply to `next`, `react`, `drizzle-orm`, `zod`, and
  `@modelcontextprotocol/sdk`.
