# ADR 0005 — Wizard Schema Reshape for Multi-Language Support

Date: 2026-05-22
Status: Accepted

## Context

Phase 1 shipped with `wizardConfigSchema` using three hardcoded literals:

```typescript
language: z.literal("typescript"),
framework: z.literal("sdk"),
transport: z.literal("streamable-http"),
```

Phase 2 added four new template variants (TypeScript stdio, Python FastMCP × 2
transports, Python FastAPI-MCP). The schema needed to expand to express all valid
combinations while enforcing cross-field constraints — for example, FastAPI-MCP only
supports Streamable HTTP transport, and TypeScript only supports the `sdk` framework.

Two schema strategies were considered:

### Option A — Discriminated union
```typescript
z.discriminatedUnion("framework", [
  z.object({ language: z.literal("typescript"), framework: z.literal("sdk"), ... }),
  z.object({ language: z.literal("python"), framework: z.literal("fastmcp"), ... }),
  z.object({ language: z.literal("python"), framework: z.literal("fastapi-mcp"),
              transport: z.literal("streamable-http"), ... }),
])
```

Pros: TypeScript narrows to the exact variant branch; invalid combinations are
structurally impossible. Cons: Zod v4 discriminated unions do not support `.pick()`,
which breaks the per-step validation pattern from ADR 0004 that calls
`wizardConfigSchema.pick({...}).safeParse(form.getValues())`.

### Option B — Flat schema + refinements (chosen)
```typescript
const wizardConfigBaseSchema = z.object({
  language:              z.enum(["typescript", "python"]),
  framework:             z.enum(["sdk", "fastmcp", "fastapi-mcp"]),
  transport:             z.enum(["streamable-http", "stdio"]),
  existingFastapiService: z.boolean().default(false),
  // ...identity, tool, logLevel, port, mcpEndpoint fields unchanged
});

export const wizardConfigSchema = wizardConfigBaseSchema
  .refine(d => !(d.framework === "sdk" && d.language !== "typescript"), { path: ["framework"] })
  .refine(d => !(d.language === "typescript" && d.framework !== "sdk"),  { path: ["framework"] })
  .refine(d => !(d.framework === "fastapi-mcp" && d.transport !== "streamable-http"), { path: ["transport"] });
```

The base schema is exported separately so per-step schemas can derive via `.pick()`:

```typescript
export const transportStepSchema = wizardConfigBaseSchema.pick({
  language: true, framework: true, transport: true,
  existingFastapiService: true, port: true, mcpEndpoint: true,
});
```

Full schema refinements run only at final submit, not on each step transition.

## Decision

Adopt **Option B** (flat schema + refinements) because:

1. It preserves the per-step validation pattern (ADR 0004) without changes.
2. The three cross-field constraints map cleanly to three `.refine()` calls.
3. Adding a new variant is a one-line `refine` change, not a union branch edit.

## `generations.config` JSONB column

The `config` JSONB column in `generations` stores a `WizardConfig` as-is. The
old shape had three literal-typed fields; the new shape has enum-typed fields.

**Migration implications:**
- Existing rows in `generations` (if any — this is a POC with no persistent data)
  remain valid: `{ language: "typescript", framework: "sdk", transport: "streamable-http" }`
  is still a valid value for all three enum fields.
- No `ALTER TABLE` migration is required. The DB column is `text` not an enum
  constraint; Drizzle validates on insert but existing rows are read back without
  re-validating against the Zod schema.
- If a future migration ever needs to query by variant, the JSONB path expressions
  `config->>'language'`, `config->>'framework'`, `config->>'transport'` will work
  against both old and new rows.

## Generator dispatch

The variant registry in `server/services/generate.ts` (`VARIANT_CONFIGS`) is the
runtime mirror of the schema. Adding a new variant requires both a new template
directory and a new entry in `VARIANT_CONFIGS`. The two are intentionally separate
so templates can be iterated on independently of the schema.

## Consequences

- `WizardConfig` now correctly types all five Phase 2 variants without widening
  existing TypeScript types.
- `existingFastapiService: boolean` is always present in the schema (even for non
  FastAPI-MCP variants) to avoid conditional types. It defaults to `false` and is
  ignored by all non-FastAPI-MCP templates.
- The wizard UI's transport step reads `wizardConfigBaseSchema` fields for reactive
  conditional rendering; `wizardConfigSchema` (with refinements) is used only at
  submit time for full validation.
