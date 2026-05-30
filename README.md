# MCP Tool Generator

A web app that generates production-grade [Model Context Protocol](https://modelcontextprotocol.io) server scaffolds for internal use. Two flows:

- **Form wizard** at `/generate` — fast path. Fill 5 steps, download a ZIP for any of the supported language/framework/transport combinations.
- **Chat-agent flow** at `/generate/chat` — guided path. A clarification agent asks questions until the spec matches MCP playbook standards, then a plan agent proposes a structured plan you can review before generating the scaffold.

Both flows produce ZIPs that boot and pass their own tests.

## Quickstart

```bash
pnpm install
pnpm db:push        # apply migrations to the configured Neon DB
pnpm dev            # http://localhost:3000
```

## Variants

The wizard supports five output template variants:

| Language | Framework | Transport | Use when |
|----------|-----------|-----------|----------|
| TypeScript | `@modelcontextprotocol/sdk` | Streamable HTTP | TS server, deployable over HTTP |
| TypeScript | `@modelcontextprotocol/sdk` | stdio | TS server, local subprocess |
| Python | FastMCP (Prefect) | Streamable HTTP | Greenfield Python server |
| Python | FastMCP (Prefect) | stdio | Greenfield Python, local |
| Python | `fastapi-mcp` (auto-derived) | Streamable HTTP | Existing FastAPI app |

The chat flow targets a sixth variant: **FastAPI + official `mcp` Python SDK** with explicit tool registration, structured logging, OTel-ready telemetry, OIDC auth seam, health endpoints, pre-zip validation, and per-tool LLM-in-the-loop eval tests. See [docs/adr/0007-multi-agent-chat-flow.md](docs/adr/0007-multi-agent-chat-flow.md).

## Chat-agent flow

```bash
# Required for the chat flow:
CHAT_FLOW_ENABLED=true
GROQ_API_KEY=gsk_...
```

Then visit `/generate/chat`. You'll describe the server in natural language, the clarification agent will ask targeted questions (referencing playbook sections), and once it has enough info the plan agent emits a structured plan with safety classes, scopes, folder layout, and a §5.5/§6.8/§7.5/§8.7/§11.6 verification checklist. Approve the plan and you get a ZIP that:

- Has `app/api/`, `app/mcp/`, `app/core/`, `app/domain/`, `app/services/`, `app/infrastructure/` layered cleanly
- Registers MCP tools explicitly in `TOOL_REGISTRY` (no auto-discovery from routes)
- Ships every tool as a stub that returns `ToolError(code="internal", message="Not yet implemented")` until you wire the real logic in `app/domain/<tool>_logic.py`
- Has structlog logging, correlation-id middleware, `/healthz` `/readyz` `/livez`, Pydantic Settings, ToolError model
- Includes per-tool unit, integration, contract, and eval test stubs

### Architecture in one paragraph

Two LLM agents on Groq's free tier. The **clarification agent** runs four internal steps per turn (extract → validate → advise → question); the **plan agent** runs synthesis + eval-generation. **Validators are pure TypeScript** ([lib/agents/validators/](lib/agents/validators/)) and gate naming, count, identifier, and schema rules — agents propose, validators enforce. The clarification turn streams via SSE from `/api/v1/chat/messages` so the UI can show phase progress. Secrets are regex-redacted from user input before any Groq call.

## Stack

- Next.js 15 App Router + TypeScript strict
- Tailwind v4 + shadcn/ui primitives
- Drizzle ORM + Neon Postgres
- Adapter seams for auth (`lib/auth/`), storage (`lib/storage/`), rate limiting (`lib/rate-limit/`) — POC uses noop/local/in-memory, real implementations stub-only
- eta v4 for template rendering
- Groq `llama-3.3-70b-versatile` for the chat agents (direct fetch, no SDK)

Full design docs in [docs/adr/](docs/adr/).

## Scripts

```bash
pnpm dev               # Next.js dev server
pnpm build             # production build
pnpm test              # unit + integration (vitest)
pnpm test:generator    # full render + pip install + pytest per template variant
pnpm test:e2e          # Playwright e2e (requires dev server)
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
pnpm db:generate       # drizzle migration
pnpm db:push           # apply schema
```

## Status

POC. Auth, billing, and the Okta/Entra adapter implementations are intentionally deferred — the seams are in place. The chat-flow path matches the canonical MCP playbook in [docs/mcp_playbook.md](docs/mcp_playbook.md). The form wizard is unchanged from earlier phases and stays as the fast path.
