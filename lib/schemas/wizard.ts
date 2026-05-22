import { z } from "zod";

export const toolParameterSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "Must start with a lowercase letter and contain only letters, digits, and underscores"),
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().min(1),
  required: z.boolean(),
});

export const toolSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "Must start with a lowercase letter and contain only letters, digits, and underscores"),
  description: z
    .string()
    .min(10, "Tool description must be at least 10 characters — make it action-oriented and concrete"),
  parameters: z.array(toolParameterSchema),
});

// Base object schema — used for step-level .pick() derivations.
// Refinements (cross-field constraints) are applied below to produce
// the exported wizardConfigSchema.
const wizardConfigBaseSchema = z.object({
  // Step 1 — Identity
  serverName: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, "Must be a valid package name slug (lowercase letters, digits, hyphens)"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be a valid semver version").default("0.1.0"),

  // Step 2 — Capabilities (one tool for Phase 1)
  tool: toolSchema,

  // Step 3 — I/O
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Step 4 — Transport
  language: z.enum(["typescript", "python"]),
  framework: z.enum(["sdk", "fastmcp", "fastapi-mcp"]),
  transport: z.enum(["streamable-http", "stdio"]),
  existingFastapiService: z.boolean().default(false),
  port: z.number().int().min(1024).max(65535).default(3000),
  mcpEndpoint: z
    .string()
    .min(1)
    .startsWith("/")
    .default("/mcp"),
});

export const wizardConfigSchema = wizardConfigBaseSchema
  // 1. "sdk" framework requires TypeScript
  .refine(
    (v) => v.framework !== "sdk" || v.language === "typescript",
    { message: 'framework "sdk" requires language "typescript"', path: ["framework"] },
  )
  // 2. TypeScript requires "sdk" framework
  .refine(
    (v) => v.language !== "typescript" || v.framework === "sdk",
    { message: 'language "typescript" requires framework "sdk"', path: ["language"] },
  )
  // 3. "fastapi-mcp" requires streamable-http transport
  .refine(
    (v) => v.framework !== "fastapi-mcp" || v.transport === "streamable-http",
    { message: 'framework "fastapi-mcp" requires transport "streamable-http"', path: ["transport"] },
  );

export type WizardConfig = z.infer<typeof wizardConfigSchema>;
export type ToolParameter = z.infer<typeof toolParameterSchema>;
export type Tool = z.infer<typeof toolSchema>;

// Per-step schemas — used to validate only the active step's fields on "Next"
export const identityStepSchema = wizardConfigBaseSchema.pick({
  serverName: true,
  displayName: true,
  description: true,
  version: true,
});

export const capabilitiesStepSchema = wizardConfigBaseSchema.pick({ tool: true });

export const ioStepSchema = wizardConfigBaseSchema.pick({ logLevel: true });

// Transport step — derived from the base schema (refinements cannot be picked
// in Zod v4, so we pick from the unrefined base object).
export const transportStepSchema = wizardConfigBaseSchema.pick({
  language: true,
  framework: true,
  transport: true,
  existingFastapiService: true,
  port: true,
  mcpEndpoint: true,
});

export const WIZARD_STEPS = [
  "identity",
  "capabilities",
  "io",
  "transport",
  "review",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
