import { getPlaybookSnippets } from "../playbook-context";
import { formatViolationsForPrompt } from "../validators";
import type { Violation } from "../validators/types";
import type {
  Advisory,
  ExtractedFacts,
  PlanProposal,
} from "@/lib/schemas/agents";
import type { LlmMessage } from "../types";

const PLAN_SCHEMA_SKETCH = `{
  "serverName": "<context>-mcp",
  "description": "one-paragraph server description",
  "tools": [
    {
      "name": "verb_noun",
      "description": "one-line summary",
      "safetyClass": "read|write|destructive",
      "idempotent": true,
      "inputs": [{ "name": "field_name", "type": "string|number|boolean|object|array", "required": true, "description": "...", "maxLength": 320 }],
      "outputShape": "free-form sketch",
      "failureModes": ["not_found", "validation"],
      "requiredScopes": ["resource:action"],
      "paginated": false,
      "doc": {
        "purpose": "imperative one-liner ('Return the current deployment status for a service.')",
        "parameters": "prose about non-obvious parameters",
        "returns": "structure of the return value, units, time zones",
        "failureModes": "what causes each ToolError.code"
      }
    }
  ],
  "folderStructure": ["app/main.py", "app/mcp/server.py", "app/mcp/tools/<name>.py", "..."],
  "crosscutting": ["structlog", "otel", "pydantic-settings", "fastapi-exceptions", "health-endpoints", "dockerfile", "k8s-base", "security-seam"],
  "verificationChecklist": ["one line per item, drawn from §5.5, §6.8, §7.5, §8.7, §11.6"]
}`;

const EVAL_SCHEMA_SKETCH = `{
  "evals": {
    "<tool_name>": [
      {
        "prompt": "plausible user prompt that should trigger this tool",
        "expectedTool": "<tool_name>",
        "expectedArguments": { "field_name": "value" }
      }
    ]
  }
}`;

export function buildPlanSynthesisMessages(
  facts: ExtractedFacts,
  preViolations: Violation[],
  advisories: Advisory[] = [],
): LlmMessage[] {
  const playbook = getPlaybookSnippets(["§5", "§6", "§7", "§8", "§11", "§22"]);
  const system = `You are an MCP solution architect synthesizing a production plan from extracted facts.

Your task:
- Produce a PlanProposal JSON document.
- Address every deterministic violation listed below by correcting it in the plan.
- For each tool, produce a structured "doc" object with purpose / parameters / returns / failureModes — these get rendered into the §7.3 docstring template.
- Recommend cross-cutting modules that ship pre-built: structlog logging, OTel telemetry, Pydantic Settings, FastAPI exception handlers, health endpoints, Dockerfile, k8s base, and the security seam (OIDC stub).
- Populate verificationChecklist with one line per item drawn verbatim from playbook §5.5, §6.8, §7.5, §8.7, §11.6.
- folderStructure lists the rendered project paths the template will produce.

Hard rules:
- Output ONLY a JSON object. No prose, no markdown.
- Every tool MUST have a valid verb_noun snake_case name. No god-tool prefixes (manage_, do_, handle_, process_).
- Server name MUST end in -mcp.
- Tool count MUST NOT exceed 30.
- Every input parameter MUST have a description and a valid snake_case Python-identifier name.
- Use "integer" type for whole-number fields (counts, IDs, page sizes, limits). Use "number" only for fractional/decimal values (amounts, latencies).
- For unbounded string inputs, set a sensible maxLength per the advisories below (e.g., emails 320, names 200, free-text 4000).
- For write/destructive tools, set idempotent: true and include an "idempotency_key" parameter when needed (§6.4).
- doc.purpose MUST be present and at least 10 characters.

Output JSON shape:
${PLAN_SCHEMA_SKETCH}

extracted_facts:
${JSON.stringify(facts, null, 2)}

deterministic_violations_to_address:
${formatViolationsForPrompt(preViolations)}

advisories_to_apply_to_the_plan:
${JSON.stringify(advisories, null, 2)}

playbook excerpts:
${playbook}`;
  return [{ role: "system", content: system }];
}

/**
 * Build messages for a *refinement* turn — the user has already approved and
 * generated a project, then asked for a change ("add a delete_order tool",
 * "move tools under src/tools/", etc.). The model receives the prior plan
 * plus the refinement instruction and emits the FULL updated plan, with the
 * change applied. We then re-run validators + (optionally) re-generate.
 */
export function buildPlanRefinementMessages(
  priorPlan: PlanProposal,
  refinement: string,
): LlmMessage[] {
  const playbook = getPlaybookSnippets(["§5", "§6", "§7", "§8", "§11", "§22"]);
  const system = `You are an MCP solution architect REVISING a previously approved plan.

A developer has approved this plan and a server was generated from it. They
have now asked for a change. Apply the change and emit the FULL updated plan
(not a diff) so the same generation pipeline can re-run end-to-end.

Hard rules — re-validated below by code, so getting these wrong wastes the user's time:
- Output ONLY a JSON object matching the PlanProposal shape (no prose, no markdown).
- Tool names MUST be lowercase snake_case verb_noun; no god-tool prefixes (manage_, do_, handle_, process_).
- Server name MUST end in -mcp.
- Tool count MUST NOT exceed 30.
- Every input parameter MUST have a description AND a valid snake_case Python-identifier name.
- Use "integer" type for whole-number fields (counts, IDs, page sizes, limits);
  "number" only for fractional/decimal values.
- For write/destructive tools, set idempotent: true.
- doc.purpose MUST be present and at least 10 characters.

Refinement semantics:
- Tools / parameters / docs / scopes / safetyClass / crosscutting — adjust per the user's request.
- folderStructure — when the user asks to restructure (e.g. "move tools under src/tools/"),
  update the folderStructure array and keep it consistent across tools.
- Preserve anything the user did NOT ask to change.
- If the request is ambiguous, make the most playbook-aligned choice; do not invent tools the user did not mention.

Output JSON shape:
${PLAN_SCHEMA_SKETCH}

prior_plan:
${JSON.stringify(priorPlan, null, 2)}

user_refinement_request:
${JSON.stringify(refinement)}

playbook excerpts:
${playbook}`;
  return [{ role: "system", content: system }];
}

export function buildEvalGenerationMessages(
  plan: Omit<PlanProposal, "violations">,
): LlmMessage[] {
  const playbook = getPlaybookSnippets(["§14"]);
  const toolSummaries = plan.tools.map((t) => ({
    name: t.name,
    description: t.description,
    safetyClass: t.safetyClass,
    inputs: t.inputs.map((i) => ({ name: i.name, type: i.type })),
  }));
  const system = `You are an MCP solution architect generating LLM-in-the-loop EVAL TESTS for each tool in this plan.

For each tool, generate 2-3 realistic user prompts a developer would type into an AI assistant that SHOULD result in the assistant calling exactly that tool with concrete arguments. These become parametrized pytest cases (§14.3) so we can verify tool-selection accuracy.

Rules:
- Output ONLY a JSON object: ${EVAL_SCHEMA_SKETCH}
- Every key in "evals" MUST be a tool name from the plan below.
- prompt: at least 10 chars, plausible English, mentions enough context to disambiguate the tool.
- expectedTool: MUST equal the key.
- expectedArguments: dict of parameter name → realistic value, matching the tool's input schema.

plan tools:
${JSON.stringify(toolSummaries, null, 2)}

playbook excerpts:
${playbook}`;
  return [{ role: "system", content: system }];
}
