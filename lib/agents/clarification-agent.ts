import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  partialExtractedFactsSchema,
  adviseLlmOutputSchema,
  questionLlmOutputSchema,
  type Advisory,
  type ClarificationTurnResult,
  type PartialExtractedFacts,
} from "@/lib/schemas/agents";
import { chat } from "./llm";
import {
  buildExtractMessages,
  buildAdviseMessages,
  buildQuestionMessages,
} from "./prompts/clarification";
import { redactSecrets } from "./redaction";
import type { LlmMessage } from "./types";
import { validateExtractedFacts } from "./validators";
import type { Violation } from "./validators/types";

export type AgentStep = "extract" | "advise" | "question" | "plan" | "evals";

export class AgentInvalidOutputError extends Error {
  constructor(
    public readonly step: AgentStep,
    public readonly detail: string,
  ) {
    super(`agent ${step} produced invalid output: ${detail}`);
    this.name = "AgentInvalidOutputError";
  }
}

export interface ClarificationHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface RunClarificationTurnInput {
  history: ClarificationHistoryEntry[];
  userMessage: string;
  priorFacts: PartialExtractedFacts;
}

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
): Promise<{ raw: string; parsed: unknown }> {
  const result = await chat({
    model,
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0.2,
  });
  return { raw: result.content, parsed: tryParseJson(result.content) };
}

function redactHistory(
  history: ClarificationHistoryEntry[],
): ClarificationHistoryEntry[] {
  return history.map((m) => ({ role: m.role, content: redactSecrets(m.content).text }));
}

async function runExtract(
  history: ClarificationHistoryEntry[],
  userMessage: string,
  priorFacts: PartialExtractedFacts,
): Promise<PartialExtractedFacts> {
  const messages = buildExtractMessages(history, userMessage, priorFacts);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { parsed } = await callJson(messages, env.OPENAI_CLARIFY_MODEL);
    const result = partialExtractedFactsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    if (attempt === 0) {
      messages.push({
        role: "system",
        content: `Your previous output failed schema validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Re-emit the same data corrected. JSON only.`,
      });
      logger.warn({ event: "clarification.extract.retry" });
      continue;
    }
    throw new AgentInvalidOutputError("extract", "schema validation failed after retry");
  }
  throw new AgentInvalidOutputError("extract", "unreachable");
}

async function runAdvise(
  facts: PartialExtractedFacts,
  violations: Violation[],
): Promise<Advisory[]> {
  try {
    const messages = buildAdviseMessages(facts, violations);
    const { parsed } = await callJson(messages, env.OPENAI_CLARIFY_MODEL);
    const result = adviseLlmOutputSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn({ event: "clarification.advise.invalid" });
      return [];
    }
    return result.data.advisories;
  } catch (e) {
    logger.warn({ event: "clarification.advise.failed", err: (e as Error).message });
    return [];
  }
}

async function runQuestion(
  facts: PartialExtractedFacts,
  violations: Violation[],
  advisories: Advisory[],
): Promise<{ nextQuestion: string | null; completenessScore: number; readyForPlan: boolean }> {
  const messages = buildQuestionMessages(facts, violations, advisories);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { parsed } = await callJson(messages, env.OPENAI_CLARIFY_MODEL);
    const result = questionLlmOutputSchema.safeParse(parsed);
    if (result.success) return result.data;
    if (attempt === 0) {
      messages.push({
        role: "system",
        content: `Your previous output failed schema validation: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Re-emit corrected. JSON only.`,
      });
      logger.warn({ event: "clarification.question.retry" });
      continue;
    }
    throw new AgentInvalidOutputError("question", "schema validation failed after retry");
  }
  throw new AgentInvalidOutputError("question", "unreachable");
}

export async function runClarificationTurn(
  input: RunClarificationTurnInput,
): Promise<ClarificationTurnResult> {
  const cleanHistory = redactHistory(input.history);
  const cleanMessage = redactSecrets(input.userMessage).text;

  const extractedFacts = await runExtract(cleanHistory, cleanMessage, input.priorFacts);
  const violations = validateExtractedFacts(extractedFacts);
  const advisories = await runAdvise(extractedFacts, violations);
  const question = await runQuestion(extractedFacts, violations, advisories);

  return {
    extractedFacts,
    violations,
    advisories,
    nextQuestion: question.nextQuestion,
    completenessScore: question.completenessScore,
    readyForPlan: question.readyForPlan,
  };
}
