# Phase 3 — Standards Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standards layer to every generated MCP server project: structured logging with trace IDs, error envelopes, /healthz endpoints, rate-limit middleware, Dockerfiles, GitHub Actions CI, and STANDARDS.md — plus a tool-description linter in the generator app that blocks generation if descriptions contain secrets or are too vague.

**Architecture:** Generator-app changes go in `lib/linter.ts` (new) wired into both the API route and server action after Zod validation. All template changes are `.eta` file edits registered in the `VARIANT_CONFIGS` table inside `server/services/generate.ts`. Generator tests cover new features via content assertions and boot-check probes.

**Tech Stack:** Hono middleware for TS rate limiting (in-memory Map, no new dep); Starlette `BaseHTTPMiddleware` + `mcp.streamable_http_app()` for Python FastMCP; FastAPI `@app.middleware("http")` for FastAPI-MCP; `structlog.contextvars` for Python trace IDs; `randomUUID` from `node:crypto` for TS trace IDs.

---

## File Map

### Generator app (new / modified)

| File | Action | What it does |
|------|--------|-------------|
| `lib/linter.ts` | **Create** | `lintToolDescription` + `lintWizardConfig` — secrets regex, length, action-verb checks |
| `lib/errors.ts` | Modify | Add `GENERATION_REFUSED` error code |
| `app/api/v1/generate/route.ts` | Modify | Call linter after Zod parse, return 400 on lint error |
| `server/actions/generate.ts` | Modify | Same linter call |
| `tests/unit/linter/description.test.ts` | **Create** | Unit tests for `lintToolDescription` and `lintWizardConfig` |

### Templates — TypeScript streamable-http

| File | Action |
|------|--------|
| `templates/typescript/streamable-http/src/index.ts.eta` | Modify — add traceId per request + rate-limit middleware |
| `templates/typescript/streamable-http/src/tools/tool.ts.eta` | Modify — add error envelope (try/catch → isError) |
| `templates/typescript/streamable-http/Dockerfile.eta` | **Create** |
| `templates/typescript/streamable-http/.github/workflows/ci.yml.eta` | **Create** |
| `templates/typescript/streamable-http/STANDARDS.md.eta` | **Create** |

### Templates — TypeScript stdio

| File | Action |
|------|--------|
| `templates/typescript/stdio/src/index.ts.eta` | Modify — add session-level traceId |
| `templates/typescript/stdio/src/tools/tool.ts.eta` | Modify — add error envelope |
| `templates/typescript/stdio/Dockerfile.eta` | **Create** |
| `templates/typescript/stdio/.github/workflows/ci.yml.eta` | **Create** |
| `templates/typescript/stdio/STANDARDS.md.eta` | **Create** |

### Templates — Python FastMCP streamable-http

| File | Action |
|------|--------|
| `templates/python/fastmcp/streamable-http/server.py.eta` | Modify — traceId via structlog contextvars, healthz custom_route, rate-limit via `mcp.streamable_http_app()` + BaseHTTPMiddleware, error envelope |
| `templates/python/fastmcp/streamable-http/Dockerfile.eta` | **Create** |
| `templates/python/fastmcp/streamable-http/.github/workflows/ci.yml.eta` | **Create** |
| `templates/python/fastmcp/streamable-http/STANDARDS.md.eta` | **Create** |

### Templates — Python FastMCP stdio

| File | Action |
|------|--------|
| `templates/python/fastmcp/stdio/server.py.eta` | Modify — traceId via structlog contextvars, error envelope |
| `templates/python/fastmcp/stdio/Dockerfile.eta` | **Create** |
| `templates/python/fastmcp/stdio/.github/workflows/ci.yml.eta` | **Create** |
| `templates/python/fastmcp/stdio/STANDARDS.md.eta` | **Create** |

### Templates — Python FastAPI-MCP streamable-http

| File | Action |
|------|--------|
| `templates/python/fastapi-mcp/streamable-http/main.py.eta` | Modify — trace-id middleware, healthz route, rate-limit middleware, error envelope |
| `templates/python/fastapi-mcp/streamable-http/Dockerfile.eta` | **Create** |
| `templates/python/fastapi-mcp/streamable-http/.github/workflows/ci.yml.eta` | **Create** |
| `templates/python/fastapi-mcp/streamable-http/STANDARDS.md.eta` | **Create** |

### Generator service (registry)

| File | Action |
|------|--------|
| `server/services/generate.ts` | Modify — register Dockerfile, `.github/workflows/ci.yml`, `STANDARDS.md` in every `VARIANT_CONFIGS` entry |

### Generator tests (updated)

| File | Action |
|------|--------|
| `tests/unit/linter/description.test.ts` | **Create** |
| `tests/generator/typescript-streamable-http.test.ts` | Modify — add content assertions + bootCheck for /healthz |
| `tests/generator/typescript-stdio.test.ts` | Modify — add content assertions |
| `tests/generator/python-fastmcp-streamable-http.test.ts` | Modify — add content assertions + bootCheck for /healthz |
| `tests/generator/python-fastmcp-stdio.test.ts` | Modify — add content assertions |
| `tests/generator/python-fastapi-mcp.test.ts` | Modify — add content assertions + bootCheck for /healthz |

---

## Task 1: Branch Setup

**Files:** (no files changed)

- [ ] **Step 1: Create the Phase 3 branch from Phase 2**

```bash
git checkout worktree-phase-2-expand-templates
git checkout -b phase-3-standards-layer
```

Expected: `Switched to a new branch 'phase-3-standards-layer'`

- [ ] **Step 2: Verify starting state — all tests pass**

```bash
pnpm typecheck && pnpm test && pnpm test:generator
```

Expected: All green. If any test is failing, do not proceed — fix it first.

---

## Task 2: Tool-Description Linter

**Files:**
- Create: `lib/linter.ts`
- Modify: `lib/errors.ts`
- Modify: `app/api/v1/generate/route.ts`
- Modify: `server/actions/generate.ts`
- Create: `tests/unit/linter/description.test.ts`

### Step 1: Write failing linter unit tests

Create `tests/unit/linter/description.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lintToolDescription, lintWizardConfig } from "@/lib/linter";
import type { WizardConfig } from "@/lib/schemas/wizard";

const CLEAN_CONFIG: WizardConfig = {
  serverName: "test-server",
  displayName: "Test Server",
  description: "A test server",
  version: "0.1.0",
  tool: {
    name: "get_greeting",
    description: "Returns a personalized greeting for the given name",
    parameters: [
      { name: "name", type: "string", description: "The person name to greet", required: true },
    ],
  },
  logLevel: "info",
  language: "typescript",
  framework: "sdk",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 3000,
  mcpEndpoint: "/mcp",
};

describe("lintToolDescription", () => {
  it("returns ok:true for a well-formed description", () => {
    const r = lintToolDescription("Returns a personalized greeting for the given name");
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("flags AWS access key in description", () => {
    const r = lintToolDescription("Authenticate using AKIAIOSFODNN7EXAMPLE from your config");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags JWT token in description", () => {
    const r = lintToolDescription(
      "Send eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in the header",
    );
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags OpenAI sk- key in description", () => {
    const r = lintToolDescription("Uses sk-proj-abc123def456ghi789jkl012mno345pqrstu for auth");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags GitHub token in description", () => {
    const r = lintToolDescription("Token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789 grants write access");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("returns error for descriptions shorter than 20 chars", () => {
    const r = lintToolDescription("short");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "DESCRIPTION_TOO_SHORT")).toBeDefined();
  });

  it("returns a warning (not error) when description has no action verb", () => {
    const r = lintToolDescription("A tool that produces a greeting for the specified name");
    expect(r.ok).toBe(true); // warnings don't block generation
    expect(r.issues.find((i) => i.code === "NOT_ACTION_ORIENTED")?.severity).toBe("warn");
  });
});

describe("lintWizardConfig", () => {
  it("passes a clean config", () => {
    expect(lintWizardConfig(CLEAN_CONFIG).ok).toBe(true);
  });

  it("fails when tool description contains a secret", () => {
    const r = lintWizardConfig({
      ...CLEAN_CONFIG,
      tool: {
        ...CLEAN_CONFIG.tool,
        description: "Uses sk-live-abc123def456ghi789jkl012mno345pqrstu for Stripe",
      },
    });
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.path).toBe("tool.description");
  });

  it("fails when a parameter description contains a secret", () => {
    const r = lintWizardConfig({
      ...CLEAN_CONFIG,
      tool: {
        ...CLEAN_CONFIG.tool,
        parameters: [
          {
            name: "key",
            type: "string",
            description: "Pass AKIAIOSFODNN7EXAMPLE as the API key",
            required: true,
          },
        ],
      },
    });
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.path).toBe("tool.parameters.key.description");
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
pnpm test tests/unit/linter/description.test.ts
```

Expected: `Error: Cannot find module '@/lib/linter'`

### Step 3: Implement `lib/linter.ts`

Create `lib/linter.ts`:

```ts
import type { WizardConfig } from "@/lib/schemas/wizard";

export type LintSeverity = "error" | "warn";

export interface LintIssue {
  code: string;
  message: string;
  severity: LintSeverity;
  path?: string;
}

export interface LintResult {
  ok: boolean;
  issues: LintIssue[];
}

const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{5,}/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
  /\bxox[bprs]-[A-Za-z0-9-]+/,
  /\bsk_live_[A-Za-z0-9]{24,}\b/,
];

const ACTION_VERB =
  /^(returns?|fetches?|gets?|creates?|updates?|deletes?|sends?|searches?|queries|checks?|validates?|converts?|generates?|provides?|retrieves?|lists?|adds?|removes?|calculates?|processes?|transforms?|parses?|extracts?|submits?|uploads?|downloads?|authenticates?|connects?|disconnects?|subscribes?|notifies?|triggers?|executes?)/i;

const MIN_LEN = 20;

export function lintToolDescription(description: string): LintResult {
  const issues: LintIssue[] = [];

  if (SECRET_PATTERNS.some((p) => p.test(description))) {
    issues.push({
      code: "PROBABLE_SECRET",
      message:
        "Description appears to contain a credential or secret (AWS key, JWT, OpenAI key, GitHub token, etc.). Remove it before generating.",
      severity: "error",
    });
  }

  if (description.length < MIN_LEN) {
    issues.push({
      code: "DESCRIPTION_TOO_SHORT",
      message: `Tool description must be at least ${MIN_LEN} characters. Got ${description.length}. Make it action-oriented and concrete.`,
      severity: "error",
    });
  }

  if (!ACTION_VERB.test(description)) {
    issues.push({
      code: "NOT_ACTION_ORIENTED",
      message:
        'Tool descriptions should start with an action verb (e.g., "Returns", "Fetches", "Creates", "Sends").',
      severity: "warn",
    });
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

export function lintWizardConfig(config: WizardConfig): LintResult {
  const issues: LintIssue[] = [];

  const toolResult = lintToolDescription(config.tool.description);
  issues.push(...toolResult.issues.map((i) => ({ ...i, path: "tool.description" })));

  for (const param of config.tool.parameters) {
    const paramResult = lintToolDescription(param.description);
    issues.push(
      ...paramResult.issues.map((i) => ({ ...i, path: `tool.parameters.${param.name}.description` })),
    );
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}
```

- [ ] **Step 4: Run linter tests to confirm they pass**

```bash
pnpm test tests/unit/linter/description.test.ts
```

Expected: All green.

- [ ] **Step 5: Add `GENERATION_REFUSED` to `lib/errors.ts`**

In `lib/errors.ts`, add `GENERATION_REFUSED` to `ErrorCodes`:

```ts
export const ErrorCodes = {
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  GENERATION_REFUSED: "GENERATION_REFUSED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  STORAGE_ERROR: "STORAGE_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;
```

- [ ] **Step 6: Wire linter into the API route**

In `app/api/v1/generate/route.ts`, add after the Zod `safeParse` success block (before the rate-limit check):

```ts
import { lintWizardConfig } from "@/lib/linter";

// Inside POST, after `if (!parsed.success) { ... }`:
const lintResult = lintWizardConfig(parsed.data);
if (!lintResult.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: ErrorCodes.GENERATION_REFUSED,
        message: "Tool description failed linter checks",
        // Return ALL issues (errors + warnings) so the client can render
        // warnings as suggestions and errors as blockers.
        details: lintResult.issues,
      },
    } satisfies ApiResult<{ url: string }>,
    { status: 400 },
  );
}
```

- [ ] **Step 7: Wire linter into the server action**

In `server/actions/generate.ts`, add the same block after the Zod `safeParse` success block:

```ts
import { lintWizardConfig } from "@/lib/linter";

// After `if (!parsed.success) { ... }`:
const lintResult = lintWizardConfig(parsed.data);
if (!lintResult.ok) {
  return {
    ok: false,
    error: {
      code: ErrorCodes.GENERATION_REFUSED,
      message: "Tool description failed linter checks",
      details: lintResult.issues,
    },
  };
}
```

- [ ] **Step 8: Add negative integration test to `tests/unit/api/generate.test.ts`**

In `tests/unit/api/generate.test.ts`, add a test that exercises the full API path to confirm the linter is actually wired in (not just that the linter function works in isolation):

```ts
it("returns 400 GENERATION_REFUSED when tool description contains an AWS key", async () => {
  const config = {
    serverName: "test-server",
    displayName: "Test Server",
    description: "A test server",
    version: "0.1.0",
    tool: {
      name: "get_item",
      description: "Uses AKIAIOSFODNN7EXAMPLE to authenticate against AWS",
      parameters: [],
    },
    logLevel: "info",
    language: "typescript",
    framework: "sdk",
    transport: "streamable-http",
    existingFastapiService: false,
    port: 3000,
    mcpEndpoint: "/mcp",
  };

  const req = new Request("http://localhost/api/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const { POST } = await import("@/app/api/v1/generate/route");
  const res = await POST(req as NextRequest);
  const body = await res.json();

  expect(res.status).toBe(400);
  expect(body.ok).toBe(false);
  expect(body.error.code).toBe("GENERATION_REFUSED");
  expect(body.error.details.some((i: { code: string }) => i.code === "PROBABLE_SECRET")).toBe(true);
});
```

- [ ] **Step 9: Write `docs/adr/0006-tool-description-linter.md`**

Create `docs/adr/0006-tool-description-linter.md`:

```markdown
# ADR 0006 — Tool-Description Linter

**Status:** Accepted  
**Date:** 2026-05-22  
**Deciders:** POC team

## Context

MCP tool descriptions are user-visible text that MCP clients (Claude Desktop, Claude Code, Cursor) display and use for tool selection. Bad descriptions — vague text, jargon, or accidentally pasted secrets — ship directly to whoever downloads the generated ZIP. We want to catch them at generation time.

## Decision

Add a `lintWizardConfig(config)` function in `lib/linter.ts` that runs after Zod schema validation and before rate-limit checks in both the API route and server action. Generation is blocked if any linter issue has `severity: "error"`.

### Why two severity levels (error / warn)?

- **Error** blocks generation. Reserved for hard-fail conditions: probable secrets (data-exfiltration risk) and descriptions too short to be useful (a 5-character description is indistinguishable from a placeholder).
- **Warning** allows generation to proceed. Used for style guidance that is subjective or context-dependent (e.g., action-verb requirement). A FastAPI endpoint named `item_lookup` is perfectly clear even without starting with "Returns".

Collapsing to a single severity would mean either blocking valid configurations or silently ignoring probable secrets. Two levels match the common "error vs. lint warning" idiom from compilers and linters.

### Why these specific secret regexes?

Focused on patterns with near-zero false-positive rate on legitimate tool descriptions:
- `AKIA[0-9A-Z]{16}` — AWS access key prefix is always 20 chars, fixed alphabet
- JWT three-part base64url — eyJ prefix is universal, the three-dot separator is distinctive
- `sk-[A-Za-z0-9_-]{20,}` — OpenAI and many derived services use this prefix
- `ghp_[A-Za-z0-9]{36}` — GitHub PAT format is fixed length
- `xox[bprs]-` — Slack token prefixes are enumerable

We did not use a full gitleaks ruleset because (a) gitleaks has ~300 rules optimised for file scanning, not short description strings, and (b) the false-positive rate on description text would be unacceptably high. The six patterns above cover the most common credentials developers accidentally paste.

### Why 20 chars minimum?

The Zod schema already enforces 10-char minimum. 20 chars is the shortest string that can express a useful action (e.g., "Returns a greeting."). Below 20, descriptions are almost certainly placeholders ("test", "my tool", "does stuff"). The number is a heuristic; if the community finds it too strict, lower to 15.

### Why is action-verb absence a warning, not an error?

Action verbs are MCP best practice but not universally applicable. Tools named after nouns ("weather_data", "item_lookup") are common in existing MCP integrations. Blocking these would be more disruptive than helpful at POC stage. The warning nudges authors toward better descriptions without breaking their flow.

### Where does the linter run?

1. After `wizardConfigSchema.safeParse()` — Zod handles structural validation; the linter handles content/semantic validation
2. Before `rateLimit.check()` — no point consuming the rate-limit budget for a request that will be rejected
3. In both the API route (`app/api/v1/generate/route.ts`) and server action (`server/actions/generate.ts`) — both call `generate()` and must enforce the same policy

The linter is **not** called inside `renderProject()` or `generate()` because those functions are called from generator tests directly with fixture configs that may not satisfy the linter (e.g., short descriptions). Keeping the linter at the API layer also makes it easy to bypass in tests without monkey-patching.

## Consequences

- Generation is blocked on probable secrets — reduces risk of users accidentally shipping credentials in tool schemas
- Actionable error codes (PROBABLE_SECRET, DESCRIPTION_TOO_SHORT, NOT_ACTION_ORIENTED) in the API response let the wizard render specific inline feedback
- False negatives exist: the regex doesn't catch every possible secret format. Defense-in-depth: the generated STANDARDS.md also tells users never to embed credentials in tool descriptions
- Generator tests can use descriptions like "Returns a greeting for the given name" (> 20 chars, action verb) to pass the linter unmodified if the linter is ever added to the test path
```

- [ ] **Step 10: Run full test suite to confirm nothing broke**

```bash
pnpm typecheck && pnpm test
```

Expected: All green.

- [ ] **Step 11: Commit**

```bash
git add lib/linter.ts lib/errors.ts app/api/v1/generate/route.ts server/actions/generate.ts \
        tests/unit/linter/description.test.ts tests/unit/api/generate.test.ts \
        docs/adr/0006-tool-description-linter.md
git commit -m "feat(linter): tool-description linter — secrets regex, length, action-verb checks"
```

---

## Task 3: TypeScript Streamable-HTTP — Trace ID + Rate Limit + Error Envelope

**Files:**
- Modify: `templates/typescript/streamable-http/src/index.ts.eta`
- Modify: `templates/typescript/streamable-http/src/tools/tool.ts.eta`
- Modify: `tests/generator/typescript-streamable-http.test.ts`

### Step 1: Add content assertions to the generator test (they will fail until templates are updated)

In `tests/generator/typescript-streamable-http.test.ts`, extend `contentAssertions` inside `testCase`:

```ts
contentAssertions: [
  // existing assertions …
  { file: "package.json", contains: '"@modelcontextprotocol/sdk": "1.29.0"' },
  { file: "src/index.ts", contains: "@modelcontextprotocol/sdk/server/mcp.js" },
  { file: "src/index.ts", contains: "WebStandardStreamableHTTPServerTransport" },
  { file: "src/index.ts", contains: "sessionIdGenerator: undefined" },
  { file: "src/tools/get_greeting.ts", contains: "export const inputSchema" },
  { file: "src/tools/get_greeting.ts", contains: "export async function handleGetGreeting" },
  { file: "src/tools/get_greeting.ts", contains: "z.string()" },
  { file: "src/tools/get_greeting.ts", contains: "z.boolean().optional()" },
  // Phase 3 — new assertions
  { file: "src/index.ts", contains: "randomUUID" },
  { file: "src/index.ts", contains: "traceId" },
  { file: "src/index.ts", contains: "_rateLimitCounts" },
  { file: "src/index.ts", contains: "RATE_LIMIT_MAX" },
  { file: "src/tools/get_greeting.ts", contains: "isError: true" },
  { file: "src/tools/get_greeting.ts", contains: "TOOL_ERROR" },
],
```

Also add `bootCheck` to the `toolchain`:

```ts
toolchain: {
  installCmd: ["pnpm", "install", "--prefer-offline"],
  testCmd: ["pnpm", "test"],
  buildCmd: ["pnpm", "build"],
  bootCheck: {
    startCmd: ["node", "dist/index.js"],
    probeUrl: "http://localhost:3000/healthz",
    expectedStatuses: [200],
    startupMs: 10_000,
    pollIntervalMs: 500,
  },
},
```

- [ ] **Step 2: Run generator test to confirm new assertions fail**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/typescript-streamable-http.test.ts
```

Expected: fails on `randomUUID` assertion.

- [ ] **Step 3: Replace `templates/typescript/streamable-http/src/index.ts.eta`**

Full new content:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { inputSchema, <%= it.tool.handlerName %> } from "./tools/<%= it.tool.name %>.js";

const logger = pino({
  name: "<%= it.serverName %>",
  level: process.env["LOG_LEVEL"] ?? "<%= it.logLevel %>",
});

// In-memory rate limiter: RATE_LIMIT_MAX requests per minute per IP.
// Replace with Redis-backed limiting (e.g. @upstash/ratelimit) before going multi-instance.
const _rateLimitCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env["RATE_LIMIT_MAX"] ?? "60");

function createServer(traceId: string) {
  const log = logger.child({ traceId });
  const server = new McpServer({
    name: "<%= it.serverName %>",
    version: "<%= it.version %>",
  });

  server.registerTool(
    "<%= it.tool.name %>",
    {
      description: "<%= it.tool.description %>",
      inputSchema,
    },
    async (input) => {
      log.info({ event: "tool.called", tool: "<%= it.tool.name %>" });
      return <%= it.tool.handlerName %>(input);
    },
  );

  return server;
}

const app = new Hono();

app.use("<%= it.mcpEndpoint %>", async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = _rateLimitCounts.get(ip) ?? { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  _rateLimitCounts.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }
  await next();
});

app.on(["GET", "POST", "DELETE"], "<%= it.mcpEndpoint %>", async (c) => {
  const traceId = c.req.header("x-trace-id") ?? randomUUID();
  logger.info({ event: "request.received", traceId });
  const server = createServer(traceId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

app.get("/healthz", (c) => c.json({ status: "ok" }));

serve(
  {
    fetch: app.fetch,
    port: Number(process.env["PORT"] ?? "<%= it.port %>"),
  },
  (info) => {
    logger.info({ event: "server.started", port: info.port });
  },
);
```

- [ ] **Step 4: Replace `templates/typescript/streamable-http/src/tools/tool.ts.eta`**

Full new content:

```ts
import { z } from "zod";

export const inputSchema = z.object({
<% for (const param of it.tool.parameters) { %>
  <%= param.name %>: z.<%= param.type %>()<% if (!param.required) { %>.optional()<% } %>.describe("<%= param.description %>"),
<% } %>
});

export type Input = z.infer<typeof inputSchema>;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export async function <%= it.tool.handlerName %>(input: Input): Promise<ToolResult> {
  try {
    // TODO: implement <%= it.tool.name %>
    void input;
    return {
      content: [{ type: "text" as const, text: "Not implemented yet" }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: { code: "TOOL_ERROR", message } }),
        },
      ],
      isError: true,
    };
  }
}
```

- [ ] **Step 5: Run generator test to confirm it passes**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/typescript-streamable-http.test.ts
```

Expected: green (render + install + test + build + bootCheck /healthz).

- [ ] **Step 6: Commit**

```bash
git add templates/typescript/streamable-http/src/index.ts.eta \
        templates/typescript/streamable-http/src/tools/tool.ts.eta \
        tests/generator/typescript-streamable-http.test.ts
git commit -m "feat(templates): TS streamable-http — traceId, rate limit, error envelope"
```

---

## Task 4: TypeScript Stdio — Trace ID + Error Envelope

**Files:**
- Modify: `templates/typescript/stdio/src/index.ts.eta`
- Modify: `templates/typescript/stdio/src/tools/tool.ts.eta`
- Modify: `tests/generator/typescript-stdio.test.ts`

### Step 1: Add content assertions to the stdio generator test

In `tests/generator/typescript-stdio.test.ts`, extend `contentAssertions`:

```ts
// Phase 3 additions:
{ file: "src/index.ts", contains: "randomUUID" },
{ file: "src/index.ts", contains: "sessionId" },
{ file: "src/tools/get_greeting.ts", contains: "isError: true" },
{ file: "src/tools/get_greeting.ts", contains: "TOOL_ERROR" },
```

- [ ] **Step 2: Run generator test to confirm new assertions fail**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/typescript-stdio.test.ts
```

Expected: fails on `randomUUID` assertion.

- [ ] **Step 3: Replace `templates/typescript/stdio/src/index.ts.eta`**

Full new content:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { inputSchema, <%= it.tool.handlerName %> } from "./tools/<%= it.tool.name %>.js";

// stdio transport uses stdin/stdout for MCP messages; log to stderr to avoid
// corrupting the MCP stream. Use pino.destination(2) — synchronous, no worker
// thread, lower startup latency than the transport worker-thread form.
const logger = pino(
  {
    name: "<%= it.serverName %>",
    level: process.env["LOG_LEVEL"] ?? "<%= it.logLevel %>",
  },
  pino.destination(2),
);

// One trace ID per stdio session. The MCP client spawns this process and owns
// the connection; there is no per-request boundary.
const sessionId = randomUUID();
logger.info({ event: "server.starting", sessionId });

const server = new McpServer({
  name: "<%= it.serverName %>",
  version: "<%= it.version %>",
});

server.registerTool(
  "<%= it.tool.name %>",
  {
    description: "<%= it.tool.description %>",
    inputSchema,
  },
  async (input) => {
    logger.info({ event: "tool.called", tool: "<%= it.tool.name %>", sessionId });
    return <%= it.tool.handlerName %>(input);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
logger.info({ event: "server.started", transport: "stdio", sessionId });
```

- [ ] **Step 4: Replace `templates/typescript/stdio/src/tools/tool.ts.eta`**

Full new content (identical logic to streamable-http version):

```ts
import { z } from "zod";

export const inputSchema = z.object({
<% for (const param of it.tool.parameters) { %>
  <%= param.name %>: z.<%= param.type %>()<% if (!param.required) { %>.optional()<% } %>.describe("<%= param.description %>"),
<% } %>
});

export type Input = z.infer<typeof inputSchema>;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export async function <%= it.tool.handlerName %>(input: Input): Promise<ToolResult> {
  try {
    // TODO: implement <%= it.tool.name %>
    void input;
    return {
      content: [{ type: "text" as const, text: "Not implemented yet" }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: { code: "TOOL_ERROR", message } }),
        },
      ],
      isError: true,
    };
  }
}
```

- [ ] **Step 5: Run generator test to confirm it passes**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/typescript-stdio.test.ts
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add templates/typescript/stdio/src/index.ts.eta \
        templates/typescript/stdio/src/tools/tool.ts.eta \
        tests/generator/typescript-stdio.test.ts
git commit -m "feat(templates): TS stdio — sessionId traceId, error envelope"
```

---

## Task 5: Python FastMCP Streamable-HTTP — All Phase 3 Updates

**Files:**
- Modify: `templates/python/fastmcp/streamable-http/server.py.eta`
- Modify: `tests/generator/python-fastmcp-streamable-http.test.ts`

This is the most complex Python update: traceId, healthz, rate-limit, error envelope, and switching from `mcp.run()` to `uvicorn.run(mcp.streamable_http_app())`.

### Precondition: Verify FastMCP API surface before writing the template

- [ ] **Precondition step: Inspect FastMCP 1.27.1 API**

The template uses `mcp.streamable_http_app()` and `@mcp.custom_route()`. Confirm both exist on the pinned version before writing any template code:

```bash
cd /tmp && python3 -c "
import subprocess, sys
subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'mcp==1.27.1'], check=True)
from mcp.server.fastmcp import FastMCP
m = FastMCP('probe')
http_methods = sorted(a for a in dir(m) if 'app' in a.lower() or 'http' in a.lower() or 'route' in a.lower())
print('HTTP/app/route methods:', http_methods)
"
```

Expected output contains `streamable_http_app` and `custom_route`. Also confirm the tool return contract:

```bash
python3 -c "
from mcp.server.fastmcp import FastMCP
mcp = FastMCP('probe')
import inspect
sig = inspect.signature(mcp.tool)
print('tool() signature:', sig)
# Check what the decorated function should return
help(FastMCP.tool)
" 2>&1 | head -30
```

If `streamable_http_app` is absent, find the correct method name (likely `sse_app` or `get_app`) and update the template content in Step 3 accordingly before proceeding.

### Step 1: Add content assertions + bootCheck to the generator test

In `tests/generator/python-fastmcp-streamable-http.test.ts`, extend `contentAssertions`:

```ts
// Phase 3 additions:
{ file: "server.py", contains: "trace_id" },
{ file: "server.py", contains: "structlog.contextvars" },
{ file: "server.py", contains: "/healthz" },
{ file: "server.py", contains: "_RateLimitMiddleware" },
{ file: "server.py", contains: "TOOL_ERROR" },
{ file: "server.py", contains: "streamable_http_app" },
```

Also add `bootCheck` to `toolchain`:

```ts
toolchain: {
  installCmd: ["uv", "sync"],
  testCmd: ["uv", "run", "pytest"],
  timeoutMs: 300_000,
  bootCheck: {
    startCmd: ["uv", "run", "python", "server.py"],
    probeUrl: "http://localhost:8765/healthz",
    expectedStatuses: [200],
    startupMs: 15_000,
    pollIntervalMs: 500,
  },
},
```

- [ ] **Step 2: Run generator test to confirm new assertions fail**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastmcp-streamable-http.test.ts
```

Expected: fails on `trace_id` assertion.

- [ ] **Step 3: Replace `templates/python/fastmcp/streamable-http/server.py.eta`**

Full new content:

```python
import os
import time
import uuid
from collections import defaultdict

import structlog
import structlog.contextvars
import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

log = structlog.get_logger()

_port = int(os.environ.get("PORT", "<%= it.port %>"))
_RATE_LIMIT = int(os.environ.get("RATE_LIMIT_MAX", "60"))

mcp = FastMCP(
    "<%= it.displayName %>",
    host="0.0.0.0",
    port=_port,
    streamable_http_path="<%= it.mcpEndpoint %>",
)


class _RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls_per_minute: int = 60) -> None:
        super().__init__(app)
        self._limit = calls_per_minute
        self._counts: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/healthz":
            return await call_next(request)
        ip = request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip()
        now = time.monotonic()
        window_start = now - 60.0
        calls = [t for t in self._counts[ip] if t > window_start]
        if len(calls) >= self._limit:
            return JSONResponse({"error": "Rate limit exceeded"}, status_code=429)
        calls.append(now)
        self._counts[ip] = calls
        return await call_next(request)


@mcp.custom_route("/healthz", methods=["GET"])
async def healthz(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


@mcp.tool()
def <%= it.tool.name %>(
<% for (const param of it.tool.parameters) { %>
    <%= param.name %>: <%= it.pythonType(param.type) %><%= !param.required ? ' = None' : '' %>,
<% } %>
) -> dict:
    """<%= it.tool.description %>"""
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(trace_id=str(uuid.uuid4()), tool="<%= it.tool.name %>")
    log.info("tool.called")
    try:
        # TODO: implement
        return {"content": [{"type": "text", "text": "Not implemented yet"}]}
    except Exception as exc:
        log.error("tool.error", error=str(exc))
        return {"error": {"code": "TOOL_ERROR", "message": str(exc)}}


if __name__ == "__main__":
    _app = mcp.streamable_http_app()
    _app.add_middleware(_RateLimitMiddleware, calls_per_minute=_RATE_LIMIT)
    uvicorn.run(_app, host="0.0.0.0", port=_port)
```

**Important:** `uvicorn` is already in `requirements.txt` for this variant, so no dependency change needed.

- [ ] **Step 4: Run generator test to confirm it passes**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastmcp-streamable-http.test.ts
```

Expected: green. If `streamable_http_app()` raises `AttributeError`, check the available method names with:
```bash
python -c "from mcp.server.fastmcp import FastMCP; m = FastMCP('x'); print([a for a in dir(m) if 'app' in a.lower() or 'http' in a.lower()])"
```
and update the method name in the template accordingly.

- [ ] **Step 5: Commit**

```bash
git add templates/python/fastmcp/streamable-http/server.py.eta \
        tests/generator/python-fastmcp-streamable-http.test.ts
git commit -m "feat(templates): Python FastMCP HTTP — traceId, healthz, rate limit, error envelope"
```

---

## Task 6: Python FastMCP Stdio — Trace ID + Error Envelope

**Files:**
- Modify: `templates/python/fastmcp/stdio/server.py.eta`
- Modify: `tests/generator/python-fastmcp-stdio.test.ts`

### Step 1: Add content assertions to the generator test

In `tests/generator/python-fastmcp-stdio.test.ts`, extend `contentAssertions`:

```ts
{ file: "server.py", contains: "trace_id" },
{ file: "server.py", contains: "structlog.contextvars" },
{ file: "server.py", contains: "TOOL_ERROR" },
```

- [ ] **Step 2: Run to confirm assertions fail**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastmcp-stdio.test.ts
```

Expected: fails on `trace_id`.

- [ ] **Step 3: Replace `templates/python/fastmcp/stdio/server.py.eta`**

Full new content:

```python
import uuid

import structlog
import structlog.contextvars
from mcp.server.fastmcp import FastMCP

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

log = structlog.get_logger()

mcp = FastMCP("<%= it.displayName %>")


@mcp.tool()
def <%= it.tool.name %>(
<% for (const param of it.tool.parameters) { %>
    <%= param.name %>: <%= it.pythonType(param.type) %><%= !param.required ? ' = None' : '' %>,
<% } %>
) -> dict:
    """<%= it.tool.description %>"""
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(trace_id=str(uuid.uuid4()), tool="<%= it.tool.name %>")
    log.info("tool.called")
    try:
        # TODO: implement
        return {"content": [{"type": "text", "text": "Not implemented yet"}]}
    except Exception as exc:
        log.error("tool.error", error=str(exc))
        return {"error": {"code": "TOOL_ERROR", "message": str(exc)}}


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

- [ ] **Step 4: Run generator test to confirm it passes**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastmcp-stdio.test.ts
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add templates/python/fastmcp/stdio/server.py.eta \
        tests/generator/python-fastmcp-stdio.test.ts
git commit -m "feat(templates): Python FastMCP stdio — traceId via contextvars, error envelope"
```

---

## Task 7: Python FastAPI-MCP — All Phase 3 Updates

**Files:**
- Modify: `templates/python/fastapi-mcp/streamable-http/main.py.eta`
- Modify: `tests/generator/python-fastapi-mcp.test.ts`

### Step 1: Add content assertions + bootCheck to the generator test

In `tests/generator/python-fastapi-mcp.test.ts`, extend `contentAssertions`:

```ts
// Phase 3 additions:
{ file: "main.py", contains: "trace_id_middleware" },
{ file: "main.py", contains: "rate_limit_middleware" },
{ file: "main.py", contains: '"/healthz"' },
{ file: "main.py", contains: "TOOL_ERROR" },
{ file: "main.py", contains: "structlog.contextvars" },
```

Also add `bootCheck` to `toolchain`:

```ts
toolchain: {
  installCmd: ["uv", "sync"],
  testCmd: ["uv", "run", "pytest"],
  timeoutMs: 300_000,
  bootCheck: {
    startCmd: ["uv", "run", "python", "-m", "uvicorn", "main:app", "--port", "8766"],
    probeUrl: "http://localhost:8766/healthz",
    expectedStatuses: [200],
    startupMs: 15_000,
    pollIntervalMs: 500,
  },
},
```

- [ ] **Step 2: Run to confirm new assertions fail**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastapi-mcp.test.ts
```

Expected: fails on `trace_id_middleware`.

- [ ] **Step 3: Replace `templates/python/fastapi-mcp/streamable-http/main.py.eta`**

Full new content:

```python
import os
import time
import uuid
from collections import defaultdict

import structlog
import structlog.contextvars
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi_mcp import FastApiMCP
from pydantic import BaseModel
from starlette.requests import Request

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

log = structlog.get_logger()

_RATE_LIMIT = int(os.environ.get("RATE_LIMIT_MAX", "60"))
_rate_counts: dict[str, list[float]] = defaultdict(list)

app = FastAPI(
    title="<%= it.displayName %>",
    version="<%= it.version %>",
)


@app.middleware("http")
async def trace_id_middleware(request: Request, call_next):
    trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(trace_id=trace_id)
    return await call_next(request)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path == "/healthz":
        return await call_next(request)
    ip = (
        request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip()
        if request.headers.get("x-forwarded-for")
        else (request.client.host if request.client else "unknown")
    )
    now = time.monotonic()
    window_start = now - 60.0
    calls = [t for t in _rate_counts[ip] if t > window_start]
    if len(calls) >= _RATE_LIMIT:
        return JSONResponse({"error": "Rate limit exceeded"}, status_code=429)
    calls.append(now)
    _rate_counts[ip] = calls
    return await call_next(request)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# --- Tool: <%= it.tool.name %> ---

class <%= it.PascalCase(it.tool.name) %>Input(BaseModel):
    <%= it.tool.parameters.length > 0
        ? it.tool.parameters.map(p => `${p.name}: ${it.pythonType(p.type)}${!p.required ? ' = None' : ''}`).join('\n    ')
        : 'pass' %>


@app.post("/tools/<%= it.tool.name %>", operation_id="<%= it.tool.name %>")
async def <%= it.tool.name %>(body: <%= it.PascalCase(it.tool.name) %>Input):
    """<%= it.tool.description %>"""
    log.info("<%= it.tool.name %>.called")
    try:
        # TODO: implement
        return {"result": "Not implemented yet"}
    except Exception as exc:
        log.error("<%= it.tool.name %>.error", error=str(exc))
        return JSONResponse(
            {"error": {"code": "TOOL_ERROR", "message": str(exc)}},
            status_code=500,
        )


# Attach MCP to the FastAPI app — auto-exposes all endpoints as MCP tools
mcp = FastApiMCP(app)
mcp.mount_http()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "<%= it.port %>"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
```

- [ ] **Step 4: Run generator test to confirm it passes**

```bash
pnpm test:generator -- --reporter=verbose tests/generator/python-fastapi-mcp.test.ts
```

Expected: green (render + install + test + bootCheck /healthz 200).

- [ ] **Step 5: Commit**

```bash
git add templates/python/fastapi-mcp/streamable-http/main.py.eta \
        tests/generator/python-fastapi-mcp.test.ts
git commit -m "feat(templates): Python FastAPI-MCP — traceId middleware, healthz, rate limit, error envelope"
```

---

## Task 8: Dockerfiles

**Files:**
- Create: `templates/typescript/streamable-http/Dockerfile.eta`
- Create: `templates/typescript/stdio/Dockerfile.eta`
- Create: `templates/python/fastmcp/streamable-http/Dockerfile.eta`
- Create: `templates/python/fastmcp/stdio/Dockerfile.eta`
- Create: `templates/python/fastapi-mcp/streamable-http/Dockerfile.eta`
- Modify: `server/services/generate.ts` (register Dockerfile in VARIANT_CONFIGS)
- Modify: all 5 generator test files (add `Dockerfile` to `expectedFiles`)

### Step 1: Add `Dockerfile` to `expectedFiles` in all 5 generator tests

In each `tests/generator/*.test.ts`, add `"Dockerfile"` to the `expectedFiles` array:

```ts
expectedFiles: [
  // ... existing files ...
  "Dockerfile",
],
```

- [ ] **Step 2: Run all generator tests to confirm they fail on missing Dockerfile**

```bash
pnpm test:generator
```

Expected: all 5 tests fail with `Expected "Dockerfile" to have property "Dockerfile"`.

- [ ] **Step 3: Create `templates/typescript/streamable-http/Dockerfile.eta`**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json ./
# --frozen-lockfile omitted: the generated project has no pnpm-lock.yaml until
# the user runs `pnpm install` locally. Add it back once you commit the lockfile.
RUN pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
ENV NODE_ENV=production
ENV PORT=<%= it.port %>
EXPOSE <%= it.port %>
CMD ["node", "dist/index.js"]
```

- [ ] **Step 4: Create `templates/typescript/stdio/Dockerfile.eta`**

```dockerfile
# syntax=docker/dockerfile:1
# Note: stdio MCP servers are typically spawned by the MCP client (Claude Desktop,
# Claude Code, Cursor), not run as standalone containers. Use this Dockerfile only
# if you need to ship the binary in a container image for distribution purposes.

FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json ./
# --frozen-lockfile omitted: add it back once pnpm-lock.yaml is committed.
RUN pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Create `templates/python/fastmcp/streamable-http/Dockerfile.eta`**

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

ENV PORT=<%= it.port %>
EXPOSE <%= it.port %>

CMD ["python", "server.py"]
```

- [ ] **Step 6: Create `templates/python/fastmcp/stdio/Dockerfile.eta`**

```dockerfile
# syntax=docker/dockerfile:1
# Note: stdio MCP servers are typically spawned by the MCP client (Claude Desktop,
# Claude Code, Cursor), not run as standalone containers.

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

CMD ["python", "server.py"]
```

- [ ] **Step 7: Create `templates/python/fastapi-mcp/streamable-http/Dockerfile.eta`**

```dockerfile
# syntax=docker/dockerfile:1

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt

COPY . .

ENV PORT=<%= it.port %>
EXPOSE <%= it.port %>

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "<%= it.port %>"]
```

- [ ] **Step 8: Register Dockerfile in every VARIANT_CONFIGS entry in `server/services/generate.ts`**

For each variant's `files` function, add:
```ts
{ tpl: "Dockerfile.eta", out: "Dockerfile" },
```

Full updated VARIANT_CONFIGS (only the `files` arrays change — add one line each):

**typescript/streamable-http:**
```ts
files: (toolName) => [
  { tpl: "package.json.eta", out: "package.json" },
  { tpl: "pnpm-workspace.yaml.eta", out: "pnpm-workspace.yaml" },
  { tpl: "tsconfig.json.eta", out: "tsconfig.json" },
  { tpl: "vitest.config.ts.eta", out: "vitest.config.ts" },
  { tpl: ".env.example.eta", out: ".env.example" },
  { tpl: "README.md.eta", out: "README.md" },
  { tpl: "Dockerfile.eta", out: "Dockerfile" },
  { tpl: "src/index.ts.eta", out: "src/index.ts" },
  { tpl: "src/tools/tool.ts.eta", out: `src/tools/${toolName}.ts` },
  { tpl: "src/tools/tool.test.ts.eta", out: `src/tools/${toolName}.test.ts` },
],
```

**typescript/stdio** — same pattern.

**python/fastmcp/streamable-http:**
```ts
files: (_toolName) => [
  { tpl: "server.py.eta", out: "server.py" },
  { tpl: "requirements.txt.eta", out: "requirements.txt" },
  { tpl: "pyproject.toml.eta", out: "pyproject.toml" },
  { tpl: "README.md.eta", out: "README.md" },
  { tpl: ".env.example.eta", out: ".env.example" },
  { tpl: "Dockerfile.eta", out: "Dockerfile" },
  { tpl: "tests/test_server.py.eta", out: "tests/test_server.py" },
],
```

**python/fastmcp/stdio** and **python/fastapi-mcp/streamable-http** — same pattern.

- [ ] **Step 9: Run all generator tests to confirm they pass**

```bash
pnpm test:generator
```

Expected: all 5 green.

- [ ] **Step 10: Commit**

```bash
git add templates/typescript/streamable-http/Dockerfile.eta \
        templates/typescript/stdio/Dockerfile.eta \
        templates/python/fastmcp/streamable-http/Dockerfile.eta \
        templates/python/fastmcp/stdio/Dockerfile.eta \
        templates/python/fastapi-mcp/streamable-http/Dockerfile.eta \
        server/services/generate.ts \
        tests/generator/
git commit -m "feat(templates): add Dockerfile to all 5 variants"
```

---

## Task 9: GitHub Actions CI for Generated Projects

**Files:**
- Create: `templates/typescript/streamable-http/.github/workflows/ci.yml.eta`
- Create: `templates/typescript/stdio/.github/workflows/ci.yml.eta`
- Create: `templates/python/fastmcp/streamable-http/.github/workflows/ci.yml.eta`
- Create: `templates/python/fastmcp/stdio/.github/workflows/ci.yml.eta`
- Create: `templates/python/fastapi-mcp/streamable-http/.github/workflows/ci.yml.eta`
- Modify: `server/services/generate.ts` (register CI file)
- Modify: all 5 generator test files (add CI file to `expectedFiles`)

### Step 1: Add CI file to `expectedFiles` in all 5 generator tests

```ts
expectedFiles: [
  // ... existing + Dockerfile ...
  ".github/workflows/ci.yml",
],
```

- [ ] **Step 2: Run all generator tests to confirm they fail**

```bash
pnpm test:generator
```

Expected: all 5 fail on `.github/workflows/ci.yml`.

- [ ] **Step 3: Create TypeScript CI template (both variants share the same content)**

Create `templates/typescript/streamable-http/.github/workflows/ci.yml.eta`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

Create `templates/typescript/stdio/.github/workflows/ci.yml.eta` with identical content.

- [ ] **Step 4: Create Python FastMCP CI template (both variants share the same content)**

Create `templates/python/fastmcp/streamable-http/.github/workflows/ci.yml.eta`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.12"
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run pytest
```

Create `templates/python/fastmcp/stdio/.github/workflows/ci.yml.eta` with identical content.

- [ ] **Step 5: Create Python FastAPI-MCP CI template**

Create `templates/python/fastapi-mcp/streamable-http/.github/workflows/ci.yml.eta`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with:
          python-version: "3.12"
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run pytest
```

- [ ] **Step 6: Register CI file in every VARIANT_CONFIGS entry in `server/services/generate.ts`**

For each variant's `files` function, add after the Dockerfile line:
```ts
{ tpl: ".github/workflows/ci.yml.eta", out: ".github/workflows/ci.yml" },
```

- [ ] **Step 7: Run all generator tests to confirm they pass**

```bash
pnpm test:generator
```

Expected: all 5 green.

- [ ] **Step 8: Commit**

```bash
git add "templates/typescript/streamable-http/.github" \
        "templates/typescript/stdio/.github" \
        "templates/python/fastmcp/streamable-http/.github" \
        "templates/python/fastmcp/stdio/.github" \
        "templates/python/fastapi-mcp/streamable-http/.github" \
        server/services/generate.ts \
        tests/generator/
git commit -m "feat(templates): add GitHub Actions CI to all 5 variants"
```

---

## Task 10: STANDARDS.md

**Files:**
- Create: `templates/typescript/streamable-http/STANDARDS.md.eta`
- Create: `templates/typescript/stdio/STANDARDS.md.eta`
- Create: `templates/python/fastmcp/streamable-http/STANDARDS.md.eta`
- Create: `templates/python/fastmcp/stdio/STANDARDS.md.eta`
- Create: `templates/python/fastapi-mcp/streamable-http/STANDARDS.md.eta`
- Modify: `server/services/generate.ts` (register STANDARDS.md)
- Modify: all 5 generator test files (add to `expectedFiles`)

### Step 1: Add `STANDARDS.md` to `expectedFiles` in all 5 generator tests

```ts
expectedFiles: [
  // ... existing + Dockerfile + .github/workflows/ci.yml ...
  "STANDARDS.md",
],
```

- [ ] **Step 2: Run all generator tests to confirm they fail**

```bash
pnpm test:generator
```

Expected: all 5 fail on `STANDARDS.md`.

- [ ] **Step 3: Create TypeScript streamable-http STANDARDS.md**

Create `templates/typescript/streamable-http/STANDARDS.md.eta`:

```markdown
# Standards Applied to This Project

Generated by [MCP Tool Generator](https://github.com/anthropics/mcp-tool-generator). The following production-grade standards are pre-wired so you can focus on tool logic, not boilerplate.

## Input Validation

Every tool input is validated with [Zod](https://zod.dev). The same schema:
- Defines the MCP tool's JSON Schema (what clients see and validate against)
- Validates incoming data at runtime before your handler runs

To change a parameter: edit `src/tools/<%= it.tool.name %>.ts` → `inputSchema`.

## Structured JSON Logging

[Pino](https://getpino.io) emits JSON to stdout. Every log line includes:
- `traceId` — **scope: per HTTP request** — a new UUID is generated for each incoming HTTP request (from `x-trace-id` header if provided, otherwise generated). All tool calls within that request share the same `traceId`.
- `event` — dot-namespaced verb-noun (`tool.called`, `server.started`)

In production, pipe stdout to a log aggregator (Datadog, Grafana Loki, etc.) that understands JSON.

## Error Envelope

When a tool handler throws an unhandled error, the transport returns:
```json
{
  "content": [{"type": "text", "text": "{\"error\":{\"code\":\"TOOL_ERROR\",\"message\":\"...\"}}"}],
  "isError": true
}
```
This keeps the MCP connection alive — clients see a structured error, not a crash.

## Health Check

`GET /healthz` → `{"status":"ok"}` with HTTP 200. Use for Kubernetes readiness/liveness probes or uptime monitors.

## Rate Limiting

The MCP endpoint is rate-limited to 60 requests per minute per IP address (in-memory, resets on process restart). Override with `RATE_LIMIT_MAX=120`.

For multi-instance deployments, replace the in-memory `Map` in `src/index.ts` with a shared store (Redis via `@upstash/ratelimit`, for example).

## Dockerfile

Multi-stage Node.js 20 Alpine build. The final image contains only `dist/` and `node_modules` — no source files, no dev tools.

```bash
docker build -t <%= it.serverName %> .
docker run -p <%= it.port %>:<%= it.port %> -e RATE_LIMIT_MAX=120 <%= it.serverName %>
```

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and PR: install → typecheck → test → build.

## Authentication

This server does **not** implement authentication. For production deployments over the network:
- Use OAuth 2.1 + PKCE as required by the [MCP authentication spec](https://spec.modelcontextprotocol.io/specification/authentication/)
- Or put the server behind a gateway that enforces auth (API key, mTLS, etc.)
- For stdio transport (local use), no auth is needed — the client spawns the process.
```

- [ ] **Step 4: Create TypeScript stdio STANDARDS.md**

Create `templates/typescript/stdio/STANDARDS.md.eta`:

```markdown
# Standards Applied to This Project

Generated by [MCP Tool Generator](https://github.com/anthropics/mcp-tool-generator).

## Input Validation

Every tool input is validated with [Zod](https://zod.dev). The same schema drives both the MCP tool definition (what clients see) and runtime validation.

## Structured JSON Logging

[Pino](https://getpino.io) logs to **stderr** (not stdout) to avoid corrupting the MCP stream. Every log includes:
- `sessionId` — **scope: per stdio session** — a single UUID generated at process startup, shared across all tool calls within the session. The MCP client spawns one process per connection; each process has one session ID.
- `event` — dot-namespaced (`tool.called`, `server.started`)

## Error Envelope

Unhandled errors in tool handlers return a structured error payload with `isError: true` instead of crashing the process.

## Rate Limiting

Not applicable. The stdio transport is local — the MCP client (Claude Desktop, Claude Code, Cursor) spawns this process directly. There is no network boundary to rate-limit.

## Dockerfile

Node.js 20 Alpine image. Note: stdio servers are typically spawned by the MCP client, not deployed as standalone services. The Dockerfile is included for distribution scenarios (e.g., shipping a self-contained binary in a Docker image).

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and PR: install → typecheck → test → build.

## Authentication

Not required for stdio. The MCP client and server run on the same machine; the client's OS permissions protect the process.
```

- [ ] **Step 5: Create Python FastMCP streamable-http STANDARDS.md**

Create `templates/python/fastmcp/streamable-http/STANDARDS.md.eta`:

```markdown
# Standards Applied to This Project

Generated by [MCP Tool Generator](https://github.com/anthropics/mcp-tool-generator).

## Input Validation

Tool inputs are validated via Python type annotations. [FastMCP](https://github.com/modelcontextprotocol/python-sdk) converts them to Pydantic models, which:
- Define the MCP tool's JSON Schema (what clients see)
- Validate incoming data at runtime before your handler runs

To change parameters: update the type annotations on the tool function in `server.py`.

## Structured JSON Logging

[structlog](https://www.structlog.org) emits JSON to stdout. Each log line includes:
- `trace_id` — **scope: per tool invocation** — a new UUID is generated at the start of each tool call via `structlog.contextvars`. Use `x-trace-id` request header correlation at the infrastructure layer (nginx, API gateway) to trace from HTTP request to tool log lines.
- `event` — dot-namespaced string (`tool.called`, `tool.error`)

## Error Envelope

Tool handlers wrap execution in `try/except`. On failure, they return:
```json
{"error": {"code": "TOOL_ERROR", "message": "..."}}
```
The MCP connection stays alive — clients see a structured error.

## Health Check

`GET /healthz` → `{"status":"ok"}` with HTTP 200. Suitable for Kubernetes probes.

## Rate Limiting

The Starlette middleware `_RateLimitMiddleware` limits requests to 60 per minute per IP (in-memory). Override with `RATE_LIMIT_MAX=120`.

For multi-instance deployments, replace the in-memory `defaultdict` with a shared store (Redis, etc.).

## Dockerfile

Python 3.12 slim image with `uv` for fast dependency installation.

```bash
docker build -t <%= it.serverName %> .
docker run -p <%= it.port %>:<%= it.port %> -e RATE_LIMIT_MAX=120 <%= it.serverName %>
```

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and PR: `uv sync` → `ruff check` → `pytest`.

## Authentication

Not implemented. Add OAuth 2.1 + PKCE per the [MCP auth spec](https://spec.modelcontextprotocol.io/specification/authentication/) before exposing over the public internet.
```

- [ ] **Step 6: Create Python FastMCP stdio STANDARDS.md**

Create `templates/python/fastmcp/stdio/STANDARDS.md.eta`:

```markdown
# Standards Applied to This Project

Generated by [MCP Tool Generator](https://github.com/anthropics/mcp-tool-generator).

## Input Validation

Tool inputs are validated via Python type annotations. FastMCP converts them to Pydantic models at runtime.

## Structured JSON Logging

[structlog](https://www.structlog.org) emits JSON. Each log line includes:
- `trace_id` — **scope: per tool invocation** — a new UUID generated at the start of each tool call via `structlog.contextvars`. stdio has no per-request boundary so per-invocation is the finest granularity available.
- `event` — dot-namespaced string

## Error Envelope

Tool handlers wrap execution in `try/except`. On failure, they return:
```json
{"error": {"code": "TOOL_ERROR", "message": "..."}}
```

## Rate Limiting

Not applicable. The stdio transport is local — no network boundary to rate-limit.

## Dockerfile

Python 3.12 slim image. stdio servers are typically spawned by the MCP client, not deployed as services. The Dockerfile is for distribution scenarios.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and PR: `uv sync` → `ruff check` → `pytest`.

## Authentication

Not required for stdio.
```

- [ ] **Step 7: Create Python FastAPI-MCP STANDARDS.md**

Create `templates/python/fastapi-mcp/streamable-http/STANDARDS.md.eta`:

```markdown
# Standards Applied to This Project

Generated by [MCP Tool Generator](https://github.com/anthropics/mcp-tool-generator).

## Input Validation

Tool inputs are validated with [Pydantic](https://docs.pydantic.dev) `BaseModel` classes. The same model:
- Validates incoming FastAPI request bodies at runtime
- Auto-generates the MCP tool schema via [fastapi-mcp](https://github.com/tadata-org/fastapi_mcp)

To add a parameter: add a field to the `<%= it.PascalCase(it.tool.name) %>Input` Pydantic model.

## Structured JSON Logging

[structlog](https://www.structlog.org) with the trace-ID middleware. Every log line includes:
- `trace_id` — **scope: per HTTP request** — bound via `trace_id_middleware` from `x-trace-id` header (or generated UUID) for the full request lifecycle. All tool calls within one HTTP request share the same `trace_id`.
- `event` — dot-namespaced string

## Error Envelope

Tool endpoints wrap execution in `try/except`. On error, they return HTTP 500 with:
```json
{"error": {"code": "TOOL_ERROR", "message": "..."}}
```

## Health Check

`GET /healthz` → `{"status":"ok"}` with HTTP 200.

## Rate Limiting

The FastAPI `rate_limit_middleware` limits requests to 60 per minute per IP (in-memory). Override with `RATE_LIMIT_MAX=120`.

## Dockerfile

Python 3.12 slim + uv + uvicorn.

```bash
docker build -t <%= it.serverName %> .
docker run -p <%= it.port %>:<%= it.port %> <%= it.serverName %>
```

## CI (GitHub Actions)

`.github/workflows/ci.yml`: `uv sync` → `ruff check` → `pytest`.

## Authentication

Not implemented. For production, add OAuth 2.1 + PKCE at the FastAPI layer or in front of the server.
```

- [ ] **Step 8: Register STANDARDS.md in every VARIANT_CONFIGS entry**

For each variant's `files` function, add:
```ts
{ tpl: "STANDARDS.md.eta", out: "STANDARDS.md" },
```

- [ ] **Step 9: Run all generator tests to confirm they pass**

```bash
pnpm test:generator
```

Expected: all 5 green.

- [ ] **Step 10: Commit**

```bash
git add templates/typescript/streamable-http/STANDARDS.md.eta \
        templates/typescript/stdio/STANDARDS.md.eta \
        "templates/python/fastmcp/streamable-http/STANDARDS.md.eta" \
        "templates/python/fastmcp/stdio/STANDARDS.md.eta" \
        "templates/python/fastapi-mcp/streamable-http/STANDARDS.md.eta" \
        server/services/generate.ts \
        tests/generator/
git commit -m "feat(templates): add STANDARDS.md to all 5 variants"
```

---

## Task 11: Full Verification

**Files:** none new — just running all checks.

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Unit + integration tests**

```bash
pnpm test
```

Expected: all green. Number of tests should be higher than Phase 2 (new linter tests added).

- [ ] **Step 3: All generator tests**

```bash
pnpm test:generator
```

Expected: 5/5 green. Each test renders, installs, tests, builds (TS) / installs, tests (Python), and boot-checks HTTP variants.

- [ ] **Step 4: Typecheck one more time with all changes in place**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 5: Final summary commit (update SPEC.md phase marker)**

In `docs/SPEC.md`, the Phase 3 section header has a "Done when:" list. No code changes needed — this is just a courtesy commit noting Phase 3 is complete.

```bash
git commit --allow-empty -m "chore: Phase 3 complete — standards layer shipped"
```

---

## Self-Review Against Spec

| Spec requirement | Covered by |
|---|---|
| Input validation (Zod / Pydantic) on every tool | Tasks 3–7 (existing from Phase 2 for TS + FastAPI-MCP; Phase 3 adds structlog contextvars for Python) |
| Structured JSON logging with trace IDs | Tasks 3–7 |
| Standard error envelope spec | Tasks 3–7 |
| `/healthz` on Streamable HTTP variants | Tasks 3, 5, 7 (TS already had it; Python variants added) |
| Dockerfile | Task 8 |
| GitHub Actions CI | Task 9 |
| `STANDARDS.md` | Task 10 |
| Rate-limit middleware on by default | Tasks 3, 5, 7 |
| Tool-description linter (secrets + vague) | Task 2 |

All 8 Phase 3 requirements covered. ✓
