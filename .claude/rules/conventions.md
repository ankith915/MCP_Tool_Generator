# Conventions

## File and folder naming
- Files: kebab-case (`workspace-switcher.tsx`, `create-template.ts`)
- React components: PascalCase export, kebab-case filename
- Hooks: `use-` prefix, kebab-case file, camelCase export (`use-workspace.ts` → `useWorkspace`)
- Types and interfaces: PascalCase, no `I` prefix
- Constants: SCREAMING_SNAKE_CASE
- Database tables: snake_case plural (`workspace_members`)
- Drizzle table consts: camelCase singular (`workspaceMembers`)
- Test files: same name as subject + `.test.ts` or `.spec.ts`

## Folder layout
```
app/
  (marketing)/         # public, unauthenticated routes
  (app)/               # would-be-authed routes (POC: noop auth passes through)
    [workspace]/       # workspace-scoped routes (POC: fixed dev workspace)
  api/
    v1/                # public API surface for the generator
  layout.tsx
components/
  ui/                  # shadcn primitives, untouched
  <feature>/           # feature-grouped (wizard/, templates/, preview/)
db/
  schema/              # one file per domain
  index.ts             # exports `db` instance
lib/
  schemas/             # Zod schemas (shared client/server)
  auth/                # AuthAdapter + implementations
    types.ts
    index.ts
    adapters/
      noop.ts          # ACTIVE
      okta.ts          # stub
      entra.ts         # stub
  storage/             # StorageAdapter + implementations
    types.ts
    index.ts
    adapters/
      local.ts         # ACTIVE
      r2.ts            # stub
  rate-limit/          # RateLimitAdapter + implementations
    types.ts
    index.ts
    adapters/
      memory.ts        # ACTIVE
      upstash.ts       # stub
  templates/           # eta wrappers, rendering helpers
  logger.ts
  env.ts               # Zod-validated env at startup
templates/             # generator OUTPUT templates (the product)
  typescript/
    streamable-http/
    stdio/
  python/
    fastmcp/
      streamable-http/
      stdio/
    fastapi-mcp/       # generates a FastAPI app + fastapi-mcp wiring
server/
  actions/             # server actions ("use server")
  services/            # business logic, transport-agnostic, testable
tests/
  factories/
  msw/
  fakes/
  e2e/                 # Playwright
```

Feature code lives under `components/<feature>/`, not scattered.
Business logic lives in `server/services/`, never in route handlers or components.

## Error envelope
Every API route and server action returns one shape:

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };
```

Rules:
- Error codes are SCREAMING_SNAKE_CASE strings defined in `lib/errors.ts`
- Never throw raw `Error` across a network boundary — convert to `ApiResult`
- `message` is user-safe; `details` is optional and never includes secrets
- Never expose stack traces, DB error text, or internal IDs to the client

## Logging
Use `lib/logger.ts` (Pino). Every log includes:
- `traceId` — propagated from the incoming request
- `workspaceId` — when in a workspace context (POC: the fixed dev workspace)
- `event` — kebab-case verb-noun (`template.rendered`, `generation.failed`)

Levels:
- `debug` — dev only, stripped in production
- `info` — successful state changes
- `warn` — recoverable issues, business rule failures
- `error` — unexpected failures with sanitized stack

See `.claude/rules/security.md` for what may never be logged.

## Adapter usage rules
The adapter pattern is the #1 architectural rule of this codebase.

- When you need auth, storage, or rate limiting: import from `lib/<thing>/`, never from `lib/<thing>/adapters/<impl>` directly
- Never reference a specific adapter outside its own folder — that's how vendor lock-in sneaks in
- Adding a new consumer of an adapter? Write a test using the active in-memory/noop implementation
- Adding a new adapter implementation? It lives in `lib/<thing>/adapters/` and must implement the full interface in `lib/<thing>/types.ts`

## Server actions vs API routes
- Server actions (`"use server"`) for in-app mutations from the UI
- API routes under `app/api/v1/` for the public generator API
- Both validate input with Zod, both return `ApiResult`

## Database access
- All queries through Drizzle, located in `server/services/*.ts`
- Components and route handlers never `import { db }` directly
- Every workspace-scoped query MUST filter by `workspace_id` — no exceptions
- Transactions for any operation touching more than one table

## React patterns
- Server Components by default; `"use client"` only when needed (state, effects, browser APIs)
- Data fetching in Server Components or server actions, not in `useEffect`
- Forms: React Hook Form + Zod resolver; error messages from the Zod schema
- No `any`; no `as unknown as` casts without an inline comment explaining why
- Async components are fine in Server Components, not in client components

## Commits & PRs
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- PR title equals the top commit title
- One logical change per PR — if you can't summarize the PR in one sentence, split it