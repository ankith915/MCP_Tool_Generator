# ADR 0008 — OpenAI Provider + AI-Authored Code Generation

**Status:** Accepted
**Date:** 2026-05-28
**Deciders:** POC team
**Supersedes parts of:** [ADR 0007](./0007-multi-agent-chat-flow.md) (§2, §4, §7)

## Context

ADR 0007 established a two-agent chat flow on Groq that produced a *plan*, which
deterministic eta templates then rendered into a scaffold. Two things changed:

1. **Groq caused reliability issues.** We moved to **OpenAI** (a user-funded key).
2. **We are raising the product's ambition.** The chat is now the hero flow, and the
   AI **authors the server code itself**, streamed live into a file tree, so engineers
   watch the server being built and get real implementations rather than only stubs.
   The output must still follow the playbook **standard** (`docs/mcp_playbook.md`) so
   teams get consistent, correct MCP servers — while allowing custom folder layouts.

The promise from CLAUDE.md still holds: the output **boots in under 2 minutes**.
Free-form AI code can fail to compile, so this ADR also records the safeguards that
keep generated projects bootable.

## Decisions

### 1. OpenAI through the Vercel AI SDK (supersedes 0007 §4)

ADR 0007 chose direct `fetch` over an SDK. We reverse that: token streaming, reasoning
summaries, and structured generation are first-class in the **Vercel AI SDK** (`ai` +
`@ai-sdk/openai`), and hand-rolling SSE parsing of OpenAI deltas for all three is
error-prone. The single chokepoint moves to [lib/agents/llm.ts](../../lib/agents/llm.ts)
— preserving 0007 §5's "single place to swap a provider," so no adapter abstraction yet.

### 2. Model routing (env-configurable)

- `OPENAI_CLARIFY_MODEL` = `gpt-4.1-mini` — fast, cheap, reliable structured extraction.
- `OPENAI_PLAN_MODEL` = `o4-mini` — a reasoning model, so its **reasoning summary** can
  stream to a "Thinking" panel (`providerOptions.openai.reasoningSummary`).
- `OPENAI_CODEGEN_MODEL` = `gpt-4.1-mini` — fast token streaming for live code.

Reasoning models reject `temperature`; `llm.ts` omits it for `o*`/`gpt-5*` models.
At current prices a full session costs a few cents — budget is not a constraint.

### 3. AI authors the code, streamed (supersedes 0007 §7, softens §2)

The plan agent still proposes structure; a new codegen agent then **writes the source
files**, emitting them with a `=== FILE: <path> ===` delimiter that the server parses
into `file-start` / `file-delta` / `file-end` SSE events. Eta templates remain in the
repo as a deterministic fallback (see §4), not as the primary output path.

### 4. Boot-reliability safeguards

- Dependency manifests (`package.json`, `pyproject.toml` / `requirements.txt`,
  `tsconfig.json`) are still rendered **deterministically** — the AI never hand-writes
  dependency versions.
- The existing validators (`lib/agents/validators/` + the pre-zip checks in
  [server/services/generate.ts](../../server/services/generate.ts), 0007 §8 **retained**)
  run against the AI output.
- On validation/parse failure **for the default layout**, fall back to the eta template
  render so the user always gets a bootable ZIP. Custom layouts have no fixed template,
  so they rely on the validators (plus an optional boot check). `pnpm test:generator`
  guards the fallback path.

### 5. Playbook is the standard; folder layout is customizable

`docs/mcp_playbook.md` is the authoritative standard injected into the codegen prompt.
The canonical layout is the **default**; users may ask to restructure ("flatten this",
"put tools under `src/tools/`"), carried on the plan's `folderStructure`/layout. The
validators enforce hard rules (naming, count caps, identifier validity) regardless of layout.

### 6. SSE protocol extended (0007 §3 retained)

The hand-rolled SSE route at `app/api/v1/chat/messages/route.ts` (and the streaming
generate route) gain `reasoning`, `file-start`, `file-delta`, and `file-end` events
alongside the existing `phase` / `done` / `error`.

## Consequences

- **New runtime deps:** `ai`, `@ai-sdk/openai` (this phase); `unpdf`, `mammoth` arrive
  with document upload. All MIT/Apache-2.0/BSD.
- **Env:** `GROQ_*` removed; `OPENAI_API_KEY` + `OPENAI_*_MODEL` + `OPENAI_MAX_TOKENS`
  added. `OPENAI_API_KEY` is required when `CHAT_FLOW_ENABLED=true`. Secrets live only in
  `.env.local`; a key exposed in chat must be rotated at the provider.
- **Output is no longer byte-for-byte deterministic.** Validators + the template fallback
  keep it bootable; this is the explicit trade for a far better build experience.
- **Phased rollout:** (1) provider swap — *this change*; (2) streaming codegen + thinking;
  (3) PDF/Word/Markdown upload; (4) iterate-in-chat refinement.
- **Adapter still deferred** (0007 §5). OpenAI is the single provider; an `LlmAdapter`
  arrives only if a second provider does.
