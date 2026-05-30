import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type ModelMessage } from "ai";
import { env } from "@/lib/env";
import type { LlmMessage } from "./types";

const provider = createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "" });

// o-series and gpt-5 are reasoning models: they reject `temperature` and manage
// their own decoding. Standard chat models still take a temperature.
function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model);
}

export interface LlmChatRequest {
  model: string;
  messages: LlmMessage[];
  responseFormat?: { type: "json_object" } | { type: "text" };
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * When supplied, the call switches to a streaming code path so reasoning
   * summaries (for reasoning models) can be surfaced live to the UI. The
   * function still returns the final text + finishReason exactly as the
   * non-streaming path; callers that don't pass `onReasoning` see no change.
   */
  onReasoning?: (delta: string) => void;
}

export interface LlmChatResult {
  content: string;
  finishReason: string;
}

interface ReasoningDeltaPart {
  type: "reasoning-delta";
  text?: string;
  textDelta?: string;
}
interface TextDeltaPart {
  type: "text-delta";
  text?: string;
  textDelta?: string;
}

/** AI SDK rebrand from `text` / `reasoning` to `text-delta` / `reasoning-delta`
 * landed in 5.0 beta.26 and the property is `.text` in current v6, but some
 * provider builds still emit `.textDelta`. Read both defensively. */
function readDelta(part: ReasoningDeltaPart | TextDeltaPart): string {
  return part.text ?? part.textDelta ?? "";
}

export async function chat(request: LlmChatRequest): Promise<LlmChatResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const reasoning = isReasoningModel(request.model);

  // Streaming path: only used when the caller wants reasoning deltas.
  // For non-reasoning models the reasoning-delta parts simply never fire,
  // so passing `onReasoning` is harmless there too.
  if (request.onReasoning) {
    const stream = streamText({
      model: provider(request.model),
      messages: request.messages as ModelMessage[],
      maxOutputTokens: request.maxTokens ?? env.OPENAI_MAX_TOKENS,
      ...(reasoning ? {} : { temperature: request.temperature ?? 0.2 }),
      abortSignal: request.signal,
      ...(reasoning
        ? { providerOptions: { openai: { reasoningSummary: "detailed" } } }
        : {}),
    });

    let textBuf = "";
    let finishReason = "stop";
    for await (const part of stream.fullStream) {
      if (part.type === "reasoning-delta") {
        const delta = readDelta(part as ReasoningDeltaPart);
        if (delta) request.onReasoning(delta);
      } else if (part.type === "text-delta") {
        textBuf += readDelta(part as TextDeltaPart);
      } else if (part.type === "finish") {
        const fr = (part as { finishReason?: string }).finishReason;
        if (fr) finishReason = fr;
      }
    }
    return { content: textBuf, finishReason };
  }

  // Non-streaming path: unchanged behaviour for existing call sites.
  const result = await generateText({
    model: provider(request.model),
    messages: request.messages as ModelMessage[],
    maxOutputTokens: request.maxTokens ?? env.OPENAI_MAX_TOKENS,
    ...(reasoning ? {} : { temperature: request.temperature ?? 0.2 }),
    abortSignal: request.signal,
  });
  return { content: result.text, finishReason: result.finishReason };
}
