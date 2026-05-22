# ADR 0006 — Tool-Description Linter

**Status:** Accepted  
**Date:** 2026-05-22  
**Deciders:** POC team

## Context

MCP tool descriptions are user-visible text that MCP clients (Claude Desktop, Claude Code, Cursor) display and use for tool selection. Bad descriptions — vague text, jargon, or accidentally pasted secrets — ship directly to whoever downloads the generated ZIP. We want to catch them at generation time.

## Decision

Add a `lintWizardConfig(config)` function in `lib/linter.ts` that runs after Zod schema validation and before rate-limit checks in both the API route and server action. Generation is blocked if any linter issue has `severity: "error"`. Warnings are returned alongside errors in the response so the wizard can render them as non-blocking suggestions.

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
- `sk_live_[A-Za-z0-9]{24,}` — Stripe secret key prefix

We did not use a full gitleaks ruleset because (a) gitleaks has ~300 rules optimised for file scanning, not short description strings, and (b) the false-positive rate on description text would be unacceptably high. The six patterns above cover the most common credentials developers accidentally paste.

### Why 20 chars minimum?

The Zod schema already enforces 10-char minimum. 20 chars is the shortest string that can express a useful action (e.g., "Returns a greeting."). Below 20, descriptions are almost certainly placeholders ("test", "my tool", "does stuff"). The number is a heuristic; if the community finds it too strict, lower to 15.

### Why is the length check NOT applied to parameter descriptions?

Parameter descriptions are type hints ("Search query", "The user ID"), not prose descriptions. Requiring 20+ chars on parameters would reject well-named, genuinely complete descriptions. The length and action-verb rules apply only to the main tool description. Parameter descriptions are only checked for secrets.

### Why is action-verb absence a warning, not an error?

Action verbs are MCP best practice but not universally applicable. Tools named after nouns ("weather_data", "item_lookup") are common in existing MCP integrations. Blocking these would be more disruptive than helpful at POC stage. The warning nudges authors toward better descriptions without breaking their flow.

### Where does the linter run?

1. After `wizardConfigSchema.safeParse()` — Zod handles structural validation; the linter handles content/semantic validation
2. Before `rateLimit.check()` — no point consuming the rate-limit budget for a request that will be rejected
3. In both the API route (`app/api/v1/generate/route.ts`) and server action (`server/actions/generate.ts`) — both call `generate()` and must enforce the same policy

The linter is **not** called inside `renderProject()` or `generate()` because those functions are called directly from generator tests with fixture configs that may not satisfy linter rules (e.g., short descriptions). Keeping the linter at the API/action layer also makes it easy to bypass in tests without monkey-patching, and matches the existing Zod validation placement.

## Consequences

- Generation is blocked on probable secrets — reduces risk of users accidentally shipping credentials in tool schemas
- Actionable error codes (`PROBABLE_SECRET`, `DESCRIPTION_TOO_SHORT`, `NOT_ACTION_ORIENTED`) in the API response let the wizard render specific inline feedback; all issues (errors + warnings) are returned so the client can surface both
- False negatives exist: the regex doesn't catch every possible secret format. Defense-in-depth: the generated `STANDARDS.md` also advises users never to embed credentials in tool descriptions
- Generator tests use descriptions like "Returns a greeting for the given name" (>20 chars, action verb) which pass the linter unmodified — the linter is only at the API layer, so generator tests that call `renderProject()` directly are unaffected
