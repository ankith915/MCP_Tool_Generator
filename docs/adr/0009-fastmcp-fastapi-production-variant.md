# ADR 0009 — Production-Grade FastMCP + FastAPI Template Variant

**Status:** Accepted
**Date:** 2026-05-30
**Deciders:** POC team
**Related:** [ADR 0007](./0007-multi-agent-chat-flow.md), [ADR 0008](./0008-openai-ai-codegen.md)

## Context

Reviewing the output of the chat-driven generator against a real production
MCP server (`network-mcp-circuit-utilization`), the gap was large enough to be
disqualifying for production use:

- `app/core/logging.py` was 22 lines of stock structlog — no context
  propagation across `await`, no `event`→`message` rename, no JSON/console
  split, no third-party log routing.
- `app/core/exceptions.py` was 14 lines — `DomainError` + three subclasses, no
  `code` / `http_status` / `to_dict()`, no `__all__`.
- `app/api/routers/health.py` was 19 lines of three trivial endpoints — no
  `CheckResult` dataclass, no per-check timeout, no `asyncio.gather`, no
  `/startupz`.
- `app/mcp/server.py` used the low-level `mcp.server.lowlevel.Server`
  primitive — not FastMCP, no flat-agent-friendly params, no
  `extra="forbid"` strictness workaround, no lifecycle bundle.

The user's chosen direction — "make the generated tools and schemas like the
reference, FastMCP all over FastAPI for production" — required a new
canonical Python target.

## Decisions

### 1. New variant: `templates/python/fastmcp-fastapi/streamable-http/`

A dedicated new template directory rather than retrofitting an existing one.
Existing templates (`fastmcp/`, `fastapi-mcp/`, `fastapi-official-mcp/`) are
untouched on disk — this avoids contradicting ADR 0007's deliberate choice of
the official low-level SDK for the `fastapi-official-mcp` variant.

### 2. Chat-flow target switched to the new variant

`AGENTIC_TEMPLATE_DIR` in `server/services/generate.ts` now points to the new
variant. The chat flow's `renderAgenticProject()` therefore emits
production-grade output by default. The old `fastapi-official-mcp` template
stays on disk but is no longer referenced by any code path; it can be removed
in a follow-up if it stays orphaned.

### 3. Seven production pillars (the bar)

The new variant must encode all seven patterns from the reference. Each is
also documented in `docs/mcp_playbook.md` §22 so the AI codegen agent
(Phase 3) can emulate them:

1. **structlog with context propagation** — `_add_app_context`,
   `_rename_event_key` (`event`→`message` for SIEM), JSON vs console
   renderer, ProcessorFormatter routing for stdlib loggers,
   `bind/clear/unbind_request_context` via contextvars.
2. **CorrelationMiddleware** — sanitize inbound `X-Correlation-ID`, mint via
   `uuid4().hex` if absent, bind to structlog context and `request.state`,
   emit `request_started`/`request_finished` with `duration_ms`, echo header.
3. **K8s probe triad** — `/healthz` `/readyz` `/startupz` with a
   `CheckResult` dataclass, per-check `asyncio.timeout`, parallel
   `asyncio.gather`, identical response envelope across all three.
4. **`AppError` hierarchy** — base class with `code` + `http_status` (ClassVars)
   + `to_dict()` + `details`, full typed tree, `__all__` export, FastAPI
   exception handler that emits `to_dict()` with correct status.
5. **`ConfigDict(extra="forbid")` Pydantic inputs** — every tool's schema in
   `app/mcp/schemas.py` declares strict extras and `Field(description=...)`.
6. **`ToolHandlers` envelope** — one async method per tool returning
   `{success, data, meta}` (or `{success: false, error}`), with the canonical
   `mcp_tool_invoked` / `_complete` / `_validation_failed` / `_app_error` log
   pair on every call. Argument *keys* are logged, never values.
7. **FastMCP wiring** — `@mcp.tool` with **flat** agent-friendly parameters
   (not nested `input:`), `_apply_strict_input` patches each auto-generated
   arg model to `extra="forbid"` + `model_rebuild(force=True)`,
   `MCPServerBundle` dataclass carrying `startup`/`shutdown` coroutines that
   FastAPI's `lifespan` wraps.

### 4. Consolidated tool layout

Unlike the old template's one-file-per-tool (`app/mcp/tools/<name>.py` +
`_spec.py` registry), the new variant uses three consolidated files plus a
per-tool stub:

- `app/mcp/schemas.py` — all Pydantic input models (iterated from plan).
- `app/mcp/tools.py` — single `ToolHandlers` class, one method per tool.
- `app/mcp/server.py` — FastMCP setup, `@mcp.tool` registrations.
- `app/domain/<tool>_logic.py` — one stub per tool (the only per-tool file).

Matches the reference's organization and reduces file count for typical
servers from `4 + N*3` to `4 + N*2`.

### 5. Playbook §22 (Reference Production Architecture)

The playbook is the standard the codegen agent's system prompt embeds. A new
§22 records each pillar with concrete code shapes. `lib/agents/prompts/plan.ts`
now pulls `§22` into its snippet set so the plan agent considers production
modules during synthesis. The Phase 3 codegen agent will pull §22 as
authoritative context.

### 6. DB enum widened

`db/schema/templates.ts` adds `"fastmcp-fastapi"` to the `framework` enum so
the agentic generator's templates-row insert validates against the schema.

## Consequences

- **Output is dramatically more production-grade.** Generated servers now
  ship with the same observability/error/health surface as a hand-written
  reference; users delete stubs and add domain logic rather than wiring
  cross-cutting concerns from scratch.
- **`renderAgenticProject` rewritten.** The test suite at
  `tests/unit/agents/render-agentic-project.test.ts` was rewritten against
  the new file layout and content patterns. Old assertions about
  `app/mcp/tools/<name>.py`, `_spec.py`, the `ToolError` envelope, etc., are
  gone; new assertions cover the seven pillars. All 14 tests pass.
- **Old `fastapi-official-mcp` template is orphaned.** No code path renders
  it. Kept on disk per the user's "leave existing untouched" directive;
  removable in a follow-up if it stays unused.
- **Phase 3 (live codegen) gets a clear standard.** The codegen agent's
  system prompt will reference §22 and use the new variant as a few-shot
  exemplar.
- **Total dependency footprint of generated projects unchanged in spirit:**
  fastapi, uvicorn, pydantic, pydantic-settings, structlog, mcp[cli], rich
  (dev only).
