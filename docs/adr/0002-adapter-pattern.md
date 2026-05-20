# ADR 0002 — Adapter Pattern for Auth, Storage, and Rate Limiting

Date: 2026-05-20
Status: Accepted

## Context
The POC needs auth, artifact storage, and rate limiting, but the production
providers (Okta/Entra, Cloudflare R2, Upstash) are either not yet selected or
not worth integration cost at POC stage. Hardcoding any provider now would
make the post-POC swap a refactor rather than a configuration change.

## Decision
Three adapter interfaces are defined and enforced NOW, even though the active
implementations are trivial:

| Interface | Active POC impl | Post-POC target |
|---|---|---|
| `AuthAdapter` | `NoopAuthAdapter` — returns a fixed dev user | `OktaAuthAdapter` or `EntraAuthAdapter` |
| `StorageAdapter` | `LocalAdapter` — writes to `.artifacts/` | `R2Adapter` — Cloudflare R2 |
| `RateLimitAdapter` | `InMemoryAdapter` — Map with TTL | `UpstashAdapter` — Upstash Redis |

Enforcement rules (checked in code review and enforced by `conventions.md`):
1. App code imports from `lib/<thing>/` only, never from
   `lib/<thing>/adapters/<impl>` directly.
2. Stub implementations throw `"not implemented"` and are never the active
   adapter in any environment.
3. Swapping a provider = one file (implementing the interface) + one env var
   change. Zero app-code changes required.

The active adapter is selected at module load time by reading the
`AUTH_PROVIDER`, `STORAGE_PROVIDER`, and `RATE_LIMIT_PROVIDER` env vars.

## Alternatives considered
- **Skip the abstraction for the POC** — rejected because the noop
  implementations are ~30 lines each. The seam costs almost nothing now and
  saves a rewrite (and a potential vendor migration incident) later.
- **Use a DI container (InversifyJS, tsyringe)** — overkill for three
  interfaces. A module-level factory in `index.ts` reading an env var is
  sufficient and has zero runtime overhead.

## Consequences
- Every new consumer of auth/storage/rate-limit must go through the adapter
  interface, never a concrete implementation.
- Wiring Okta or Entra post-POC is a single PR: implement the interface, set
  the env var, delete the noop. Requires its own ADR at that time.
- `NoopAuthAdapter` is acceptable ONLY in controlled environments (local dev,
  private Vercel deploy with password protection). Never expose it publicly.
