import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  planLlmOutputSchema,
  evalGenerationLlmOutputSchema,
  type Advisory,
  type EvalPrompt,
  type ExtractedFacts,
  type PlanProposal,
  type ProposedTool,
} from "@/lib/schemas/agents";
import { AgentInvalidOutputError } from "./clarification-agent";
import { chat } from "./llm";
import {
  buildPlanSynthesisMessages,
  buildEvalGenerationMessages,
  buildPlanRefinementMessages,
} from "./prompts/plan";
import type { LlmMessage } from "./types";
import { validateExtractedFacts, validatePlan } from "./validators";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callJson(
  messages: LlmMessage[],
  model: string,
  onReasoning?: (delta: string) => void,
): Promise<unknown> {
  const result = await chat({
    model,
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0.2,
    onReasoning,
  });
  return tryParseJson(result.content);
}

async function runPlanSynthesis(
  facts: ExtractedFacts,
  preViolations: ReturnType<typeof validateExtractedFacts>,
  advisories: Advisory[],
  onReasoning?: (delta: string) => void,
): Promise<Omit<PlanProposal, "violations">> {
  const messages = buildPlanSynthesisMessages(facts, preViolations, advisories);
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = await callJson(messages, env.OPENAI_PLAN_MODEL, onReasoning);
    const result = planLlmOutputSchema.safeParse(parsed);
    if (result.success) return result.data;
    if (attempt === 0) {
      messages.push({
        role: "system",
        content: `Your previous output failed schema validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Re-emit corrected. JSON only.`,
      });
      logger.warn({ event: "plan.synthesis.retry" });
      continue;
    }
    throw new AgentInvalidOutputError("plan", "synthesis schema validation failed after retry");
  }
  throw new AgentInvalidOutputError("plan", "unreachable");
}

async function runEvalGeneration(
  plan: Omit<PlanProposal, "violations">,
): Promise<ProposedTool[]> {
  try {
    const messages = buildEvalGenerationMessages(plan);
    const parsed = await callJson(messages, env.OPENAI_PLAN_MODEL);
    const result = evalGenerationLlmOutputSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn({ event: "plan.evals.invalid" });
      return plan.tools;
    }
    const evalsByName = result.data.evals;
    return plan.tools.map((t) => {
      const fromLlm = evalsByName[t.name];
      const evals: EvalPrompt[] = (fromLlm ?? []).filter(
        (e) => e.expectedTool === t.name,
      );
      return { ...t, evals };
    });
  } catch (e) {
    logger.warn({ event: "plan.evals.failed", err: (e as Error).message });
    return plan.tools;
  }
}

export interface RunPlanAgentOptions {
  /** Called with each reasoning-summary delta the plan model emits.
   * The plan agent currently uses a reasoning model (default `o4-mini`) for
   * synthesis; non-reasoning models simply never fire this. */
  onReasoning?: (delta: string) => void;
}

/**
 * Refine an already-generated plan based on a free-text user request.
 *
 * Re-runs the full validator pass on the refined plan, so the same hard rules
 * (tool naming, count caps, identifier validity) apply. Eval generation is
 * intentionally skipped — refinements are usually narrow ("add a tool",
 * "rename X"), and the prior plan's evals stay attached to unchanged tools.
 * The caller can re-run eval generation later if it wants fresh evals.
 */
export async function refinePlan(
  priorPlan: PlanProposal,
  refinement: string,
  options: RunPlanAgentOptions = {},
): Promise<PlanProposal> {
  const messages = buildPlanRefinementMessages(priorPlan, refinement);
  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = await callJson(
      messages,
      env.OPENAI_PLAN_MODEL,
      options.onReasoning,
    );
    const result = planLlmOutputSchema.safeParse(parsed);
    if (result.success) {
      const refined: PlanProposal = {
        ...result.data,
        violations: [],
      };
      refined.violations = validatePlan(refined);
      return refined;
    }
    if (attempt === 0) {
      messages.push({
        role: "system",
        content: `Your previous output failed schema validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Re-emit corrected. JSON only.`,
      });
      logger.warn({ event: "plan.refine.retry" });
      continue;
    }
    throw new AgentInvalidOutputError("plan", "refinement schema validation failed after retry");
  }
  throw new AgentInvalidOutputError("plan", "unreachable");
}

export async function runPlanAgent(
  facts: ExtractedFacts,
  advisories: Advisory[] = [],
  options: RunPlanAgentOptions = {},
): Promise<PlanProposal> {
  const preViolations = validateExtractedFacts(facts);
  const draft = await runPlanSynthesis(
    facts,
    preViolations,
    advisories,
    options.onReasoning,
  );
  const toolsWithEvals = await runEvalGeneration(draft);
  const finalPlan: PlanProposal = {
    ...draft,
    tools: toolsWithEvals,
    violations: [],
  };
  finalPlan.violations = validatePlan(finalPlan);
  return finalPlan;
}
