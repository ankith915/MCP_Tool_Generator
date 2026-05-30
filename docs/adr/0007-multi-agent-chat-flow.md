# ADR 0007 — Multi-Agent Chat Flow Architecture

**Status:** Accepted
**Date:** 2026-05-23
**Deciders:** POC team

## Context

The form-based wizard at `/generate` collected fields and produced a scaffold, but did not help engineers *think* about what they were building. Users would fill in vague tool descriptions, ignore safety classes, miss pagination, and download a ZIP that looked right but didn't reflect MCP best practices. The output didn't fail tests — it just wasn't a good MCP server.

We needed a flow that:
1. Asked clarifying questions until the description matched playbook standards.
2. Proposed a structured plan the user could review and refine.
3. Enforced hard rules (naming, count caps, identifier validity) deterministically.
4. Surfaced soft judgment calls (pagination, `max_length`, bounded-context splits) as LLM-driven recommendations.
5. Produced a scaffold matching the canonical layout (`app/api/`, `app/mcp/`, `app/core/`, `app/domain/`, etc.) with all cross-cutting concerns pre-built.

## Decisions

### 1. Two agents, not one

A **clarification agent** runs first (`extract → validate → advise → question`), then a **plan agent** runs when `readyForPlan === true`. Each agent owns one concern. Clarification asks; plan synthesizes. A single combined agent would have to juggle question generation, schema synthesis, and validation in one prompt — empirically unstable on Groq's free models at ~70B parameter size.

### 2. Agents propose, validators enforce

Hard rules (naming regex, banned god-tool prefixes, max-30-tool cap, Python keyword collisions, duplicate names) live in [lib/agents/validators/](../../lib/agents/validators/) as pure TypeScript. The LLM is told about violations in the prompt as "MUST address" but cannot override them — the validators re-run server-side after every LLM call and the result is gated. Soft judgments (pagination recommendations, `max_length` advice, description quality, bounded-context splits) are LLM-driven and surfaced as `advisories[]` separately from `violations[]`.

This split exists because LLMs are unreliable at mechanical correctness across long lists. A 70B model will happily emit `manage_orders` and say it follows the rules, will miss that `class` is a reserved Python keyword as a parameter name, and will lose count past ~15 tools. Code never lies about these.

### 3. SSE in route handlers, not server actions

Streaming agent output is naturally suited to SSE. The project's convention is server actions for in-app mutations, but server actions don't support raw streaming control — every action call is one round-trip. Token streaming and server-side state-machine transitions (clarifying ↔ planning) need raw streaming.

We chose hand-rolled SSE in a Next.js Route Handler at `app/api/v1/chat/messages/route.ts`. The non-streaming chat routes (`/sessions`, `/approve`, `/generate`) still use the `ApiResult<T>` envelope and behave like normal POST endpoints. SSE-over-Route-Handler is ~40 lines of `ReadableStream` boilerplate and keeps all Groq calls inside the single chokepoint at [lib/agents/groq-client.ts](../../lib/agents/groq-client.ts).

### 4. Direct `fetch`, no Groq SDK

Groq exposes an OpenAI-compatible REST endpoint at `https://api.groq.com/openai/v1/chat/completions`. Wrapping it via `fetch` is ~50 lines including retry-on-429 + jittered backoff. Adding `groq-sdk` or `@ai-sdk/groq` would pull in transitive deps for marginal ergonomic gain, plus the SDK's response types would conflict with our Zod-validated structured outputs (every Groq call returns either streamed tokens or `response_format: { type: "json_object" }` followed by `safeParse` against a domain schema).

Single chokepoint, single dep boundary, single place to swap a future provider.

### 5. Groq client is NOT an adapter

The project's adapter pattern lives in `lib/auth/`, `lib/storage/`, `lib/rate-limit/`. Each has multiple potential implementations (Okta vs Entra, R2 vs S3, in-memory vs Upstash). The LLM provider in this POC is one — Groq. We have no second provider on the roadmap.

Wrapping a single implementation in an adapter interface adds boilerplate without enabling anything, and pre-empts the design decisions a second-provider integration would actually force (token counting, model routing, fallback strategies, cost tracking). When a second provider appears, *that* is when we introduce an `LlmAdapter` interface; until then, [lib/agents/groq-client.ts](../../lib/agents/groq-client.ts) is the single chokepoint and there's no abstraction to refactor.

### 6. Postgres-backed sessions

Two new tables — `agent_sessions` and `agent_messages` — store the conversation. `generations.session_id` is a nullable FK so the chat path links back to the wizard's existing artifact bookkeeping. Sessions survive page reloads and let us add multi-device or replay later.

Alternatives considered: ephemeral in-memory (lose on reload), localStorage (no audit trail per playbook §17). Both rejected.

### 7. New template variant for FastAPI + official mcp SDK

`templates/python/fastapi-official-mcp/streamable-http/` is the target output. Choices:
- **Official `mcp` Python SDK over `fastapi-mcp`.** Explicit `TOOL_REGISTRY` in `app/mcp/tools/__init__.py`, no auto-discovery from FastAPI routes (anti-pattern §A1). The MCP tool list is a deliberate product decision, not a side effect of routing.
- **Tools return `ToolError`, not raise.** Each generated tool function returns `ToolError(code="internal", message="Not yet implemented", retryable=False)` until the user wires real logic. Raising `NotImplementedError` would let a Python exception leak across the MCP boundary; returning a structured error gives the LLM a typed signal it can act on.
- **Structured docstrings.** The plan agent produces `{ purpose, parameters, returns, failureModes }` and the eta template renders the §7.3 docstring shape. The LLM doesn't write free-form prose into Python source.
- **Cross-cutting modules ship pre-built.** structlog config, correlation-id middleware, health endpoints, OIDC seam stub, Pydantic Settings, ToolError model, exception hierarchy. The user fills in business logic in `app/domain/<tool>_logic.py` only.

### 8. Pre-zip validation

After rendering and before zipping, [server/services/generate.ts](../../server/services/generate.ts) re-runs identifier and duplicate-name checks against the rendered file list. The same rules that the LLM was told about run again, in code, against the actual output. Full pyright/ruff/pip-install validation was rejected as too slow for an interactive chat flow (multi-minute install). The CI generator-test path can layer that on top.

## Consequences

- **Two LLM calls per clarification turn (extract + advise + question = 3, actually).** ~3–5s end-to-end on Groq's free tier. Acceptable for a chat flow where the user is reading between turns.
- **The wizard stays.** `/generate` is unchanged. The chat lives at `/generate/chat`. Two flows coexist; the simple-fast path is still available.
- **Validators are the source of truth for hard rules.** Adding a new naming convention or banned prefix = editing TypeScript, not editing prompts. Test-driven changes.
- **Adding new LLM providers in future = introduce an `LlmAdapter` interface and swap [lib/agents/groq-client.ts](../../lib/agents/groq-client.ts).** Not blocked, just deferred.
- **No multi-tenancy / replay / rolling-summary memory yet.** JSONB `summary` field supports them without migration when the time comes.
- **Generated code is a scaffold, not a finished server.** Tool stubs return `ToolError(code="internal")` until the user implements `compute_<tool>` in `app/domain/`. README documents this clearly.
