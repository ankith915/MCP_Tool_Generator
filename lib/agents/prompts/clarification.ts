import { getPlaybookSnippets } from "../playbook-context";
import { formatViolationsForPrompt } from "../validators";
import type { Violation } from "../validators/types";
import type {
  Advisory,
  PartialExtractedFacts,
} from "@/lib/schemas/agents";
import type { LlmMessage } from "../types";

const EXTRACT_SCHEMA_SKETCH = `{
  "serverName": "<context>-mcp",
  "purpose": "one-paragraph description of what this server does and why",
  "boundedContext": "the single bounded context this server covers",
  "dataSources": [{ "name": "string", "classification": "public|internal|confidential|restricted" }],
  "externalServices": ["string"],
  "trafficShape": "optional rough QPS / burst description",
  "sloTargets": { "p95LatencyMs": 250, "availability": "99.9%" },
  "proposedTools": [
    {
      "name": "verb_noun (snake_case, e.g. get_deployment_status)",
      "description": "one-paragraph imperative description; cite the safety class",
      "safetyClass": "read|write|destructive",
      "idempotent": true,
      "inputs": [
        { "name": "snake_case_field", "type": "string|integer|number|boolean|object|array", "required": true, "description": "what this parameter is" }
      ],
      "outputShape": "free-form sketch of return value",
      "failureModes": ["validation", "not_found", "..."],
      "requiredScopes": ["resource:action"]
    }
  ]
}`;

const ADVISE_SCHEMA_SKETCH = `{
  "advisories": [
    {
      "topic": "pagination|max_length|description_quality|bounded_context|idempotency|safety_class|other",
      "severity": "info|suggestion|warning",
      "path": "tools[0]",
      "message": "user-facing prose",
      "section": "§8.5"
    }
  ]
}`;

const QUESTION_SCHEMA_SKETCH = `{
  "nextQuestion": "exactly one question, plain English, under 30 words — or null if readyForPlan is true",
  "completenessScore": 0.0_to_1.0,
  "readyForPlan": true_when_all_required_fields_set_and_no_blocking_gaps
}`;

export function buildExtractMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  priorFacts: PartialExtractedFacts,
): LlmMessage[] {
  const playbook = getPlaybookSnippets(["§5", "§6", "§7", "§8"]);
  const system = `You are an MCP solution architect performing FACT EXTRACTION ONLY.

Your task: read the conversation history plus the user's latest message and emit a single JSON object capturing the CURRENT state of facts about the MCP server they want to build. You MUST merge with prior_facts — do not drop information, only update or extend it.

Hard rules:
- Output ONLY a JSON object. No prose, no markdown, no commentary.
- Do NOT ask questions or invent tools the user has not described.
- Tool names MUST be lowercase snake_case verb_noun. Never use god-tool prefixes (manage_, do_, handle_, process_).
- Server name MUST end in -mcp.
- For fields not yet known, OMIT them. Do not hallucinate placeholders.

Output JSON shape (omit unknown fields):
${EXTRACT_SCHEMA_SKETCH}

prior_facts:
${JSON.stringify(priorFacts, null, 2)}

playbook excerpts:
${playbook}`;

  const messages: LlmMessage[] = [{ role: "system", content: system }];
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

export function buildAdviseMessages(
  facts: PartialExtractedFacts,
  violations: Violation[],
): LlmMessage[] {
  const playbook = getPlaybookSnippets(["§5", "§6", "§8", "§11"]);
  const system = `You are an MCP solution architect performing QUALITATIVE ADVISORY ANALYSIS.

You are given the current extracted facts and any deterministic violations already detected by code. Your job: surface QUALITATIVE recommendations that deterministic rules cannot catch. Do NOT re-report deterministic violations — they are already handled.

Focus on:
- Pagination (§8.5): tools returning lists SHOULD accept limit + cursor.
- max_length: unbounded "string" inputs invite payload abuse — recommend sensible caps (e.g. email → 320, name → 200).
- Description quality (§2.4, §7.3): vague, generic, or formulaic descriptions degrade tool-selection accuracy.
- Bounded context (§5.3): if proposed tools span multiple bounded contexts, recommend splitting into multiple servers.
- Idempotency (§6.4): write or destructive tools SHOULD be idempotent or accept idempotency_key.
- Safety class (§6.2): confirm the declared class matches the described behaviour.

Output ONLY a JSON object matching this shape:
${ADVISE_SCHEMA_SKETCH}

If you have no advisories, return { "advisories": [] }.

deterministic_violations_already_detected:
${formatViolationsForPrompt(violations)}

current_facts:
${JSON.stringify(facts, null, 2)}

playbook excerpts:
${playbook}`;
  return [{ role: "system", content: system }];
}

export function buildQuestionMessages(
  facts: PartialExtractedFacts,
  violations: Violation[],
  advisories: Advisory[],
): LlmMessage[] {
  const system = `You are an MCP solution architect deciding the NEXT QUESTION to ask the developer.

Inputs:
- Current extracted facts (some fields may be missing).
- Deterministic violations (must be addressed before approval).
- Qualitative advisories (recommendations to consider).

Rules:
- Required-before-plan fields: serverName, purpose, boundedContext, at least one proposedTool with name+description+safetyClass+at least one input parameter.
- If any required field is missing, ask about ONE of them.
- If a deterministic violation is blocking, ask about it (e.g., "Tool name 'manage_user' is a god-tool — what discrete tool did you mean?").
- If a critical "warning" advisory is unresolved, surface it as a question.
- "suggestion" and "info" advisories DO NOT block readiness — they will be applied by the plan agent. Do not ask about them.
- Set readyForPlan: TRUE when all required fields are set AND there are zero blocking violations AND no "warning"-severity advisories remain. Soft fields (data classification, scopes, SLO targets) are NICE TO HAVE — do not block on them once they've been mentioned once.
- When readyForPlan is true, nextQuestion MUST be null.
- Ask EXACTLY ONE question, plain English, under 30 words.
- Calibrate completenessScore: 0.0–0.4 = missing required fields, 0.5–0.7 = required fields set but few soft fields, 0.8–1.0 = required + some soft fields set (cross 0.85 to declare readyForPlan).

Output ONLY a JSON object matching this shape:
${QUESTION_SCHEMA_SKETCH}

current_facts:
${JSON.stringify(facts, null, 2)}

deterministic_violations:
${formatViolationsForPrompt(violations)}

advisories:
${JSON.stringify(advisories, null, 2)}`;
  return [{ role: "system", content: system }];
}
