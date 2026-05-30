"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ClarificationTurnResult,
  PlanProposal,
} from "@/lib/schemas/agents";

export type ChatPhase = "idle" | "clarifying" | "planning";

export interface ChatDonePayload {
  type: "clarification" | "plan";
  payload: ClarificationTurnResult | PlanProposal;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export interface ChatStreamState {
  phase: ChatPhase;
  isStreaming: boolean;
  lastResult:
    | { kind: "clarification"; data: ClarificationTurnResult }
    | { kind: "plan"; data: PlanProposal }
    | null;
  /** Accumulated reasoning-summary text from the plan model. Reset on each
   * new send so the thinking panel only ever shows the current turn. */
  reasoningText: string;
  error: ChatErrorPayload | null;
}

const INITIAL_STATE: ChatStreamState = {
  phase: "idle",
  isStreaming: false,
  lastResult: null,
  reasoningText: "",
  error: null,
};

interface SendArgs {
  sessionId: string;
  content: string;
  /** Pre-extracted, redacted text from an uploaded document (PDF / DOCX / MD).
   * Forwarded to the messages route, which weaves it into the clarification
   * agent's context for this turn only. */
  attachmentText?: string;
  attachmentName?: string;
}

interface UseChatStreamOptions {
  onClarification?: (result: ClarificationTurnResult) => void;
  onPlan?: (plan: PlanProposal) => void;
  onError?: (err: ChatErrorPayload) => void;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const [state, setState] = useState<ChatStreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const send = useCallback(
    async ({ sessionId, content, attachmentText, attachmentName }: SendArgs) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ phase: "idle", isStreaming: true, lastResult: null, reasoningText: "", error: null });

      let res: Response;
      try {
        res = await fetch("/api/v1/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            content,
            ...(attachmentText ? { attachmentText, attachmentName } : {}),
          }),
          signal: controller.signal,
        });
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: "NETWORK", message: (err as Error).message },
      }));
      return;
    }

    if (!res.body) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        error: { code: "INTERNAL_ERROR", message: "Response had no body" },
      }));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let eventName = "message";
          let dataStr = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;
          let data: unknown;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }
          if (eventName === "phase") {
            const stage = (data as { stage: ChatPhase }).stage;
            setState((s) => ({ ...s, phase: stage }));
          } else if (eventName === "reasoning") {
            const { delta } = data as { delta: string };
            setState((s) => ({ ...s, reasoningText: s.reasoningText + delta }));
          } else if (eventName === "done") {
            const payload = data as ChatDonePayload;
            if (payload.type === "clarification") {
              const clar = payload.payload as ClarificationTurnResult;
              setState((s) => ({
                ...s,
                lastResult: { kind: "clarification", data: clar },
              }));
              optionsRef.current.onClarification?.(clar);
            } else {
              const plan = payload.payload as PlanProposal;
              setState((s) => ({
                ...s,
                lastResult: { kind: "plan", data: plan },
              }));
              optionsRef.current.onPlan?.(plan);
            }
          } else if (eventName === "error") {
            const err = data as ChatErrorPayload;
            setState((s) => ({ ...s, error: err }));
            optionsRef.current.onError?.(err);
          }
        }
      }
    } finally {
      setState((s) => ({ ...s, isStreaming: false, phase: "idle" }));
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, send, reset };
}
