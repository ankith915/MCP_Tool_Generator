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

export const wizardConfigSchema = z.object({
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

  // Step 4 — Transport (fixed for Phase 1)
  language: z.literal("typescript"),
  framework: z.literal("sdk"),
  transport: z.literal("streamable-http"),
  port: z.number().int().min(1024).max(65535).default(3000),
  mcpEndpoint: z
    .string()
    .min(1)
    .startsWith("/")
    .default("/mcp"),
});

export type WizardConfig = z.infer<typeof wizardConfigSchema>;
export type ToolParameter = z.infer<typeof toolParameterSchema>;
export type Tool = z.infer<typeof toolSchema>;

// Per-step schemas — used to validate only the active step's fields on "Next"
export const identityStepSchema = wizardConfigSchema.pick({
  serverName: true,
  displayName: true,
  description: true,
  version: true,
});

export const capabilitiesStepSchema = wizardConfigSchema.pick({ tool: true });

export const ioStepSchema = wizardConfigSchema.pick({ logLevel: true });

export const transportStepSchema = wizardConfigSchema.pick({
  language: true,
  framework: true,
  transport: true,
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
