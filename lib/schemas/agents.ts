import { z } from "zod";

export const safetyClassSchema = z.enum(["read", "write", "destructive"]);
export type SafetyClass = z.infer<typeof safetyClassSchema>;

export const dataClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export type DataClassification = z.infer<typeof dataClassificationSchema>;

export const proposedToolInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "integer", "number", "boolean", "object", "array"]),
  required: z.boolean(),
  description: z.string().min(1),
  maxLength: z.number().int().positive().optional(),
});
export type ProposedToolInput = z.infer<typeof proposedToolInputSchema>;

export const toolDocSchema = z.object({
  purpose: z.string().min(10),
  parameters: z.string().default(""),
  returns: z.string().default(""),
  failureModes: z.string().default(""),
});
export type ToolDoc = z.infer<typeof toolDocSchema>;

export const evalPromptSchema = z.object({
  prompt: z.string().min(10),
  expectedTool: z.string().min(1),
  expectedArguments: z.record(z.string(), z.unknown()).default({}),
});
export type EvalPrompt = z.infer<typeof evalPromptSchema>;

export const proposedToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  safetyClass: safetyClassSchema,
  idempotent: z.boolean().default(false),
  inputs: z.array(proposedToolInputSchema).default([]),
  outputShape: z.string().default(""),
  failureModes: z.array(z.string()).default([]),
  requiredScopes: z.array(z.string()).default([]),
  paginated: z.boolean().optional(),
  doc: toolDocSchema.optional(),
  evals: z.array(evalPromptSchema).default([]),
});
export type ProposedTool = z.infer<typeof proposedToolSchema>;

export const dataSourceSchema = z.object({
  name: z.string().min(1),
  classification: dataClassificationSchema,
});
export type DataSource = z.infer<typeof dataSourceSchema>;

export const sloTargetsSchema = z.object({
  p95LatencyMs: z.number().int().positive().optional(),
  availability: z.string().optional(),
});

export const extractedFactsSchema = z.object({
  serverName: z.string().min(1),
  purpose: z.string().min(1),
  boundedContext: z.string().min(1),
  dataSources: z.array(dataSourceSchema).default([]),
  externalServices: z.array(z.string()).default([]),
  trafficShape: z.string().optional(),
  sloTargets: sloTargetsSchema.optional(),
  proposedTools: z.array(proposedToolSchema).default([]),
});
export type ExtractedFacts = z.infer<typeof extractedFactsSchema>;

export const partialExtractedFactsSchema = extractedFactsSchema.partial();
export type PartialExtractedFacts = z.infer<typeof partialExtractedFactsSchema>;

export const advisorySchema = z.object({
  topic: z.enum([
    "pagination",
    "max_length",
    "description_quality",
    "bounded_context",
    "idempotency",
    "safety_class",
    "other",
  ]),
  severity: z.enum(["info", "suggestion", "warning"]),
  path: z.string().optional(),
  message: z.string().min(1),
  section: z.string().optional(),
});
export type Advisory = z.infer<typeof advisorySchema>;

export const violationSchema = z.object({
  code: z.string(),
  path: z.string(),
  message: z.string(),
  section: z.string().optional(),
});

export const clarificationTurnResultSchema = z.object({
  extractedFacts: partialExtractedFactsSchema,
  violations: z.array(violationSchema).default([]),
  advisories: z.array(advisorySchema).default([]),
  nextQuestion: z.string().nullable(),
  completenessScore: z.number().min(0).max(1),
  readyForPlan: z.boolean(),
});
export type ClarificationTurnResult = z.infer<typeof clarificationTurnResultSchema>;

export const adviseLlmOutputSchema = z.object({
  advisories: z.array(advisorySchema).default([]),
});

export const questionLlmOutputSchema = z.object({
  nextQuestion: z.string().nullable(),
  completenessScore: z.number().min(0).max(1),
  readyForPlan: z.boolean(),
});

export const crosscuttingSchema = z.enum([
  "structlog",
  "otel",
  "pydantic-settings",
  "fastapi-exceptions",
  "health-endpoints",
  "dockerfile",
  "k8s-base",
  "security-seam",
]);
export type Crosscutting = z.infer<typeof crosscuttingSchema>;

export const planProposalSchema = z.object({
  serverName: z.string().min(1),
  description: z.string().min(1),
  tools: z.array(proposedToolSchema).min(1).max(30),
  folderStructure: z.array(z.string()).default([]),
  crosscutting: z.array(crosscuttingSchema).default([]),
  verificationChecklist: z.array(z.string()).default([]),
  violations: z.array(violationSchema).default([]),
});
export type PlanProposal = z.infer<typeof planProposalSchema>;

export const planLlmOutputSchema = planProposalSchema.omit({
  violations: true,
});

export const evalGenerationLlmOutputSchema = z.object({
  evals: z.record(z.string(), z.array(evalPromptSchema)),
});
