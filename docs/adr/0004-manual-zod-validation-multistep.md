# ADR 0004 — Manual per-step Zod validation instead of zodResolver

Date: 2026-05-21
Status: Accepted

## Context

The wizard form uses React Hook Form (RHF) for multi-step state management.
The natural integration between RHF and Zod is `zodResolver` from the
`@hookform/resolvers` package. The original plan used this resolver.

During Phase 1c, `@hookform/resolvers@5.2.2` was installed alongside
`zod@4.4.3`. Typecheck immediately failed with:

```
Argument of type 'ZodObject<...>' is not assignable to parameter of type
'Zod3Type<...>'.
  The types of '_zod.version.minor' are incompatible between these types.
    Type '4' is not assignable to type '0'.
```

**Root cause:** `@hookform/resolvers` v5 includes support for both Zod v3 and
Zod v4, but the TypeScript types perform a structural check on
`_zod.version.minor`. Zod v4.4.x sets this internal field to `4`; the
`@hookform/resolvers` Zod v4 overload expects it to be `0` (as it was in an
early Zod v4 alpha). This is a version skew between the resolver's type
definitions and the released Zod v4.x series — a bug in
`@hookform/resolvers`, not in either Zod or RHF.

**Why not use `zod/v3` compatibility shim?** Zod v4 ships a `zod/v3` compat
path that re-exports a Zod v3-compatible API. This would require importing
the wizard schema from two separate Zod versions — the app uses Zod v4 for
server-side validation (API routes, server actions), and switching the wizard
schema to Zod v3 types would create divergence that breaks the shared-schema
contract between client and server.

**Why not use a global resolver at all?** A multi-step form has an additional
problem with full-schema resolvers: at step 1, fields like `tool.name` and
`port` are not yet filled. A full-schema resolver reports errors for all
fields on every validation pass. The user would see errors on step 5's fields
while they are still on step 1 — poor UX and confusing error state.

## Decision

Perform validation manually in `WizardShell.handleNext()`:

1. `useForm()` is created **without** a resolver — RHF manages form state
   but defers validation entirely to the application.
2. Each step has a picked sub-schema (e.g. `identityStepSchema = wizardConfigSchema.pick({...})`).
3. On "Next", `safeParse` the current step's sub-schema against `form.getValues()`.
4. On failure, call `form.setError(path, { message })` for each `issue` in the Zod error.
5. On success, call `form.clearErrors()` and navigate to the next step.

RHF's `FormProvider` + `useFormContext` must be used (not a plain React
context) so that `setError()` calls propagate reactive updates to child step
components. (A custom `createContext` doesn't wire up RHF's internal
subscription mechanism.)

## Consequences

- **Positive:** Clean per-step validation — only the current step's fields are
  validated; future steps never show premature errors.
- **Positive:** Zero dependency on `@hookform/resolvers`. One less package
  with an indirect Zod version constraint.
- **Positive:** The validation logic is explicit and readable — `safeParse` +
  `setError` is a standard pattern that any engineer familiar with Zod can
  follow without knowing RHF's resolver API.
- **Neutral:** `form.trigger()` (RHF's built-in re-validation) no longer works
  because there is no resolver. All validation goes through `handleNext()`. If
  you need field-level real-time feedback (e.g., as-you-type), add explicit
  `onChange` handlers that call `safeParse` on the relevant field schema.
- **When this is revisited:** If `@hookform/resolvers` releases a version that
  correctly supports Zod v4.x (matching `_zod.version.minor`), the resolver
  can be reintroduced. The per-step sub-schemas in `lib/schemas/wizard.ts` will
  still be useful for the resolver's `context` parameter to scope validation.
  The `WizardShell.handleNext()` validation would be replaced by
  `form.trigger(stepFieldNames[activeStep])`.
