# MCP Tool Generator — 5-Minute Demo Script

A structured walkthrough for a presenter showing the MCP Tool Generator to an
audience. Total running time: ~5 minutes. Each beat lists what to click or
type, what to say, and what the audience sees.

---

## Pre-Demo Setup (before the clock starts)

- [ ] Browser open to `/` on a running instance (local or deployed)
- [ ] Terminal open in an empty working directory (e.g. `~/Desktop/demo/`)
- [ ] `pnpm` available on `PATH` — confirm with `pnpm --version`
- [ ] A ZIP of a previously generated project ready to go (fallback if the
      download step hangs)
- [ ] (Optional) Claude Desktop or Claude Code installed and running, to
      demonstrate MCP server registration at the end
- [ ] Note the server port: wizard defaults to 3000; confirm `curl http://localhost:3000/healthz` before the demo

---

## Act 1 — The Landing Page (~45 seconds)

### Beat 1 — Orient the audience

- **Click/type:** Navigate to `/`. Let the hero section load fully.
- **Say:** "This is the MCP Tool Generator. MCP — the Model Context Protocol —
  is the open standard for connecting AI models to external tools and data
  sources. Every major AI client, Claude, GPT, Gemini, supports it. The problem
  is that standing up a production-quality MCP server still takes a day of
  boilerplate. This tool collapses that to two minutes."
- **Audience sees:** Hero headline, subtitle, and the two CTAs — "Start
  building →" and "View gallery →".

### Beat 2 — Call out the three value props

- **Click/type:** Scroll down slowly to the three-column feature strip beneath
  the hero.
- **Say:** "Three things worth calling out: all five variants — TypeScript
  Streamable HTTP, TypeScript stdio, Python FastMCP Streamable HTTP, Python
  FastMCP stdio, and Python FastAPI-MCP — are supported out of the box. Second, the standards your team actually cares about — structured
  logging with trace IDs, error envelopes, input validation, rate limiting,
  health checks — are baked into every output, not bolted on later. Third,
  every download is genuinely production-ready: Dockerfile, GitHub Actions CI,
  and a STANDARDS.md that documents every convention the generated code
  follows."
- **Audience sees:** Three feature cards beneath the hero.

---

## Act 2 — The Gallery (~1 minute)

### Beat 3 — Open the gallery

- **Click/type:** Click "View gallery →" in the hero.
- **Say:** "Before we build anything, let's look at the finish line. The gallery
  shows three live previews — actual generated code, not screenshots."
- **Audience sees:** `/gallery` with three code preview panels side by side.

### Beat 4 — Tour the three previews

- **Click/type:** Click through the file tabs on the TypeScript weather-server
  panel first, then glance at the Python FastMCP search-server, then the
  FastAPI-MCP orders-server.
- **Say:** "The TypeScript server on the left uses `@modelcontextprotocol/sdk`
  directly. The middle one is Python FastMCP — the official Python SDK. The
  right panel is FastAPI-MCP: if you already have a FastAPI service in
  production, this variant auto-exposes your endpoints as MCP tools with one
  line of wiring — `FastApiMCP(app)`. All three have the same structural
  guarantees: trace IDs on every request, a consistent error shape, and a
  `/healthz` endpoint for your load balancer. Notice the STANDARDS.md link in
  each README — that file ships inside the ZIP and tells the next engineer
  exactly what conventions they're inheriting."
- **Audience sees:** Syntax-highlighted code in Monaco, file tabs, the
  STANDARDS.md reference.

---

## Act 3 — Wizard Walkthrough (~2 minutes)

### Beat 5 — Start the wizard

- **Click/type:** Click the browser back button or the logo to return to `/`,
  then click "Start building →".
- **Say:** "Now let's build something real. We'll create a GitHub Issues MCP
  server — a tool that fetches open issues for any repository."
- **Audience sees:** Step 1 of the wizard — the Identity step.

### Beat 6 — Identity step (Step 1 of 5)

- **Click/type:** Fill in:
  - Server name: `github-issues`
  - Display name: `GitHub Issues Server`
  - Description: `Fetches open GitHub issues for a repository`
- **Say:** "The server name becomes your package name and Docker image tag. The
  display name is what Claude and other AI clients show users. The description
  gets embedded in the generated README and the MCP manifest."
- **Audience sees:** Form fields populate; the live Monaco preview on the right
  updates in real time as you type.

### Beat 7 — Capabilities step (Step 2 of 5)

- **Click/type:** Click "Next →" to advance. On the Capabilities step, add a
  tool:
  - Tool name: `list_issues`
  - Tool description: `Lists all open issues for a GitHub repository, returning issue number, title, and URL`
- **Say:** "Each tool maps to one MCP tool definition. The description is what
  the AI model reads to decide when to call this tool — so being specific here
  directly improves AI behavior."
- **Audience sees:** A tool card appears; the preview panel updates with a
  `server.tool("list_issues", ...)` block.

### Beat 8 — I/O step (Step 3 of 5)

- **Click/type:** Click "Next →". Add a parameter to `list_issues`:
  - Name: `repo`
  - Type: `string`
  - Required: checked
  - Description: `The repository in owner/name format, e.g. anthropics/anthropic-sdk-python`
- **Say:** "Parameters are fully typed. On the TypeScript output, this becomes
  a Zod schema. On Python, it's a Pydantic model. The validation runs at the
  MCP boundary before your tool logic ever executes."
- **Audience sees:** A parameter row added to the tool; the preview shows the
  Zod or Pydantic schema update.

### Beat 9 — Transport step (Step 4 of 5)

- **Click/type:** Click "Next →". Select:
  - Language: TypeScript
  - Framework: (official SDK — the only TS option)
  - Transport: Streamable HTTP
- **Say:** "Two transport choices: Streamable HTTP is the right default for
  anything network-reachable — it's the modern MCP transport and supports
  streaming responses. Stdio is for local tools that Claude Desktop launches
  as a subprocess. We'll pick Streamable HTTP."
- **Audience sees:** Transport cards with radio buttons; the preview switches
  to show the HTTP server bootstrap code.

### Beat 10 — Review step (Step 5 of 5)

- **Click/type:** Click "Next →" to land on the Review step. Spend two seconds
  scrolling the final preview.
- **Say:** "The Review step is a final read-back before download. The Monaco
  preview here shows the complete generated file tree. Everything is real,
  runnable code — no placeholder TODOs in the critical paths."
- **Audience sees:** Full file tree in the preview, a "Download ZIP" button.

---

## Act 4 — Download and Boot (~1 minute)

### Beat 11 — Download

- **Click/type:** Click "Download ZIP". Switch to the terminal while the
  browser downloads.
- **Say:** "Downloading now. This is a complete project scaffold — not a
  starter kit you then have to gut. Let's unzip and boot it."
- **Audience sees:** Browser download bar; ZIP file lands in the Downloads
  folder (or wherever the browser is set).

### Beat 12 — Install and start

- **Click/type:** In the terminal:
  ```bash
  cd ~/Desktop/demo
  unzip ~/Downloads/github-issues.zip
  cd github-issues
  pnpm install
  pnpm dev
  ```
- **Say:** "pnpm install pulls the exact pinned versions the generator
  declared. Then `pnpm dev` boots the MCP server. You'll see structured JSON
  logs — trace ID on every line."
- **Audience sees:** pnpm install output; server startup logs in JSON format
  with `traceId` fields visible.

### Beat 13 — Health check

- **Click/type:** Open a second terminal tab and run:
  ```bash
  curl http://localhost:3000/healthz
  ```
- **Say:** "Every HTTP variant ships with `/healthz`. Your orchestrator, your
  load balancer, your uptime monitor — they all get a real health check on day
  one."
- **Audience sees:**
  ```json
  { "status": "ok" }
  ```

---

## Wrap (~15 seconds)

### Beat 14 — Close

- **Click/type:** No action needed — stay on the terminal.
- **Say:** "That's TypeScript with Streamable HTTP. The exact same workflow
  produces Python — just pick FastMCP or FastAPI-MCP on the Transport step.
  If you've already got a FastAPI service, FastAPI-MCP means you write zero
  new tool definitions: your existing endpoint schemas become MCP tools
  automatically. The generated project includes a STANDARDS.md that documents
  every convention — logging, error shapes, rate limits — so the next engineer
  who opens it knows exactly what they're looking at."
- **Audience sees:** Running server in the terminal.

---

## Tips

### Common audience questions

**"Which transport should I use?"**
Streamable HTTP for anything that runs on a server or in a container. Stdio
for tools that Claude Desktop launches locally as a subprocess. When in doubt,
choose Streamable HTTP — it's the direction the MCP spec is moving.

**"What about auth on the generated server?"**
The generated server leaves auth as an explicit TODO in `STANDARDS.md`. The
recommended pattern is OAuth 2.1 + PKCE at the transport layer, which the MCP
spec mandates for production deployments. The scaffold keeps the seam clean so
you can add a middleware without touching tool logic.

**"Does this support streaming tool responses?"**
The Streamable HTTP variants support SSE streaming out of the box — the
transport layer is already wired. Whether your tool streams depends on your
implementation; the scaffold includes a comment showing where to yield
incremental results.

**"Can I add more tools after downloading?"**
Yes — the generated project is plain code. Add tools by following the pattern
in the existing tool file. The STANDARDS.md explains naming, validation, and
logging conventions so additions stay consistent.

**"What versions of Python/Node does the output target?"**
Node 20 LTS for TypeScript. Python 3.11+ for the Python variants. Both are
specified in the Dockerfile and the GitHub Actions workflow, so CI uses the
same version you run locally.

### If the download takes more than a few seconds

Switch to the terminal immediately and start `cd`-ing into the pre-prepared
fallback ZIP. Say: "I've got a pre-built copy here — same output, just skipping
the download UI." The audience does not need to see the browser download bar.

### If `pnpm install` fails (network issue, registry timeout)

Use the fallback: prepare a directory with `node_modules` already installed
before the demo. Keep it at `~/Desktop/demo-preinstalled/github-issues/` and
just `cd` there and run `pnpm dev`. Say nothing about the install step; go
straight to showing the running server.

### If the server fails to start

Most likely a port conflict. Kill whatever is on 3000 first:
```bash
lsof -ti :3000 | xargs kill -9
pnpm dev
```
If the server still fails, open the pre-built version in the gallery (`/gallery`)
and say: "Let me show you the output in the browser while we sort this out." The
gallery previews are fully navigable and make a fine stand-in.

### If the audience is technical and wants to go deeper

Point them at `STANDARDS.md` inside the generated ZIP — it links the specific
RFCs and design decisions. Then offer to walk the template source: the
generator templates live in `templates/<language>/<framework>/<transport>/` in
the repo.
