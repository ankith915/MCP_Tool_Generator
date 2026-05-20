# Product Spec — MCP Tool Generator (POC)

## What we're building
A web app where engineers fill out a form describing an MCP (Model Context
Protocol) tool and receive a production-ready scaffold. The POC proves the
generator + standards engine concept; auth and billing are stubbed via
adapters and will be wired up post-POC.

## POC success criterion
An engineer fills out the wizard, picks a language and framework, downloads
the ZIP, and within 2 minutes has a working MCP server they can connect to
Claude Desktop, Claude Code, or any MCP client.

## In scope (POC)
- Wizard form that generates working MCP server projects
- **TypeScript** output (official `@modelcontextprotocol/sdk`)
- **Python — FastMCP** output (official Python SDK)
- **Python — FastAPI-MCP** output (auto-exposes existing FastAPI endpoints as MCP tools via the `fastapi-mcp` library)
- Streamable HTTP and stdio transports
- Generated projects boot out of the box
- Adapter foundation: auth (noop default + Okta/Entra stubs), storage (local default + R2 stub), rate limit (memory default + Upstash stub)
- Live Monaco preview as the form is filled

## Out of scope (POC — DO NOT BUILD)
- Real auth wiring (Okta, Entra) — adapter stubs only, never wire the implementations
- Billing, Stripe, pricing pages, usage metering
- SSO, SCIM, audit-log export, custom workspace templates
- Marketplace, public template registry
- CLI tool, GitHub/GitLab push, internal developer portal API
- A2A protocol
- Hosting users' generated MCP servers

## Stack
See `.claude/rules/stack.md`. Locked.

## Architecture surfaces
1. **Form + preview UI** — multi-step wizard, JSON-schema-driven, live Monaco preview
2. **Template engine** — eta-based, the matrix lives in `templates/<language>/<framework>/<transport>/`
3. **Generation API** — `/api/v1/generate` accepts a config and returns a ZIP URL
4. **Adapter foundation** — auth, storage, rate-limit interfaces with active no-op / in-memory implementations and stubbed real providers

---

## Phases (POC)

Each phase has a hard "done" definition. Do not skip ahead. Close each phase with a brief retro and any updates to `.claude/rules/*`.

### Phase 0 — Foundation
**Done when:**
- Next.js 15 + TS strict + Tailwind v4 + shadcn/ui initialized
- Drizzle + Neon connected; initial schema for `users`, `workspaces`, `workspace_members`, `templates`, `generations`
  (POC: `users` and `workspaces` exist as plain tables; `NoopAuthAdapter` returns a fixed dev user mapped to a single seeded workspace)
- `AuthAdapter` interface defined; `NoopAuthAdapter` active; `OktaAuthAdapter` and `EntraAuthAdapter` stubs present and throw "not implemented"
- `StorageAdapter` interface defined; `LocalAdapter` active (writes to `.artifacts/`); `R2Adapter` stub
- `RateLimitAdapter` interface defined; `InMemoryAdapter` active; `UpstashAdapter` stub
- Vitest smoke test + Playwright e2e test passing
- GitHub Actions CI green (typecheck, lint, test)
- Vercel deploy from `main` working (with Vercel password protection enabled — POC is not publicly accessible)
- First ADR (`docs/adr/0001-stack-choice.md`) recorded
- Second ADR (`docs/adr/0002-adapter-pattern.md`) recording why the three adapter interfaces exist before they're needed

### Phase 1 — Generator core, one template end-to-end
**Done when:**
- One template variant only: TypeScript + Streamable HTTP
- Wizard form: identity → capabilities → I/O → transport → review
- Live Monaco preview updates as the user fills the form
- "Download ZIP" produces a project that boots with `pnpm install && pnpm dev`
- Generator test renders the template and runs its tests in CI
- Each generation recorded in the `generations` table with template version + MCP SDK version
- Rate limiting (in-memory) active on `/api/v1/generate`

### Phase 2 — Expand templates
**Done when:**
- **Python FastMCP** variant — both Streamable HTTP and stdio
- **Python FastAPI-MCP** variant — the wizard asks "Do you have an existing FastAPI service?" and on yes, generates a FastAPI app with `FastApiMCP(app)` wiring, Pydantic models for tools, and a `requirements.txt` including `fastapi`, `fastapi-mcp`, and `uvicorn`
- TypeScript stdio variant
- Every variant has a generator test (render + install + boot)
- Wizard supports the full language × framework × transport selection
- Output project's `README.md` documents how to register with Claude Desktop, Claude Code, and Cursor

### Phase 3 — Standards layer
**Done when every generated project includes:**
- Input validation (Zod for TS, Pydantic for Python) on every tool — same schema drives validation and the MCP tool definition
- Structured JSON logging with trace ids (Pino for TS, structlog for Python)
- Standard error envelope spec
- `/healthz` endpoint on Streamable HTTP variants
- Dockerfile + GitHub Actions CI (lint + test + build)
- `STANDARDS.md` in the generated project explaining what was applied and why
- Rate-limit middleware on by default
- Tool-description linter at generation time — refuses to generate if descriptions are vague, missing examples, or contain probable secrets (regex check for AWS keys, JWTs, `sk-*` tokens)

### Phase 4 — POC polish & demo readiness
**Done when:**
- Clean landing page explains what the tool does in 60 seconds
- Sample gallery shows 3 generated projects (TS, Python FastMCP, Python FastAPI-MCP)
- App README and in-product docs explain how to run the generated projects
- 5-minute demo script at `docs/demo.md`
- POC is deployable behind any private URL with no auth provider configured

---

## After the POC (FOR CONTEXT ONLY — do not build until greenlit)

These are listed so Claude Code understands the trajectory, not as a license to start them early.

- **Phase 5** — Wire `OktaAuthAdapter` implementation against the customer's Okta tenant. Validate ID tokens via JWKS. Add SCIM if needed.
- **Phase 6** — Wire `EntraAuthAdapter` implementation against Microsoft Entra ID. Same pattern as Okta.
- **Phase 7** — Workspaces with four roles (owner, admin, developer, viewer); custom org templates; audit logs exportable to S3/SIEM.
- **Phase 8** — Billing via Stripe (Free, Team, Enterprise).
- **Phase 9** — GitHub/GitLab "Push as PR" integration, CLI (`npx create-mcp@latest`), public API consumable from Backstage/Port.

---

## Non-negotiables (apply across all phases)
- Tool definitions never leave our infra except as the user's downloaded artifact
- Every generation is reproducible: template version + SDK version recorded in the `generations` row
- Streamable HTTP is the default transport in the wizard; stdio is a toggle (per the 2026 MCP roadmap)
- The generator refuses to embed secrets in tool schemas
- The three adapter interfaces (auth, storage, rate-limit) are never bypassed — even in POC where the active implementations are trivial. That's what makes post-POC integration a one-file swap.
- All MCP best practices for tool descriptions (action-oriented, concrete, with examples) are linted at generation time