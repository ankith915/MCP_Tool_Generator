"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GenerateStage = "rendering" | "zipping" | "done";

export interface FileBuffer {
  path: string;
  content: string;
  complete: boolean;
}

export interface GenerateState {
  status: "idle" | "streaming" | "done" | "error";
  stage: GenerateStage | null;
  /** path → buffer with accumulated content + completion flag. */
  files: Record<string, FileBuffer>;
  /** Paths in the order their `file-start` event arrived (UI display order). */
  order: string[];
  /** The path of the most recently started or updated file — auto-focused. */
  activePath: string | null;
  artifactUrl: string | null;
  error: { code: string; message: string } | null;
}

const INITIAL_STATE: GenerateState = {
  status: "idle",
  stage: null,
  files: {},
  order: [],
  activePath: null,
  artifactUrl: null,
  error: null,
};

export interface UseGenerateStreamOptions {
  onDone?: (artifactUrl: string) => void;
  onError?: (err: { code: string; message: string }) => void;
}

interface SendArgs {
  sessionId: string;
}

/**
 * Drive the live workspace by consuming the SSE stream from
 * /api/v1/chat/generate. The state object is the single source of truth for
 * <CodeWorkspace>.
 */
export function useGenerateStream(options: UseGenerateStreamOptions = {}) {
  const [state, setState] = useState<GenerateState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const send = useCallback(async ({ sessionId }: SendArgs) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...INITIAL_STATE, status: "streaming" });

    let res: Response;
    try {
      res = await fetch("/api/v1/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      });
    } catch (err) {
      const e = { code: "NETWORK", message: (err as Error).message };
      setState((s) => ({ ...s, status: "error", error: e }));
      optionsRef.current.onError?.(e);
      return;
    }

    if (!res.body) {
      const e = { code: "INTERNAL_ERROR", message: "Response had no body" };
      setState((s) => ({ ...s, status: "error", error: e }));
      optionsRef.current.onError?.(e);
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
            const stage = (data as { stage: GenerateStage }).stage;
            setState((s) => ({ ...s, stage }));
          } else if (eventName === "file-start") {
            const { path } = data as { path: string };
            setState((s) => {
              if (s.files[path]) return s;
              return {
                ...s,
                files: {
                  ...s.files,
                  [path]: { path, content: "", complete: false },
                },
                order: [...s.order, path],
                activePath: path,
              };
            });
          } else if (eventName === "file-delta") {
            const { path, text } = data as { path: string; text: string };
            setState((s) => {
              const existing = s.files[path] ?? {
                path,
                content: "",
                complete: false,
              };
              return {
                ...s,
                files: {
                  ...s.files,
                  [path]: { ...existing, content: existing.content + text },
                },
                activePath: path,
              };
            });
          } else if (eventName === "file-end") {
            const { path } = data as { path: string };
            setState((s) => {
              const existing = s.files[path];
              if (!existing) return s;
              return {
                ...s,
                files: {
                  ...s.files,
                  [path]: { ...existing, complete: true },
                },
              };
            });
          } else if (eventName === "done") {
            const { artifactUrl } = data as { artifactUrl: string };
            setState((s) => ({
              ...s,
              status: "done",
              stage: "done",
              artifactUrl,
            }));
            optionsRef.current.onDone?.(artifactUrl);
          } else if (eventName === "error") {
            const err = data as { code: string; message: string };
            setState((s) => ({ ...s, status: "error", error: err }));
            optionsRef.current.onError?.(err);
          }
        }
      }
    } catch (err) {
      // AbortError just means the user navigated away — not a real error.
      if ((err as Error).name === "AbortError") return;
      const e = { code: "STREAM_ERROR", message: (err as Error).message };
      setState((s) => ({ ...s, status: "error", error: e }));
      optionsRef.current.onError?.(e);
    }
  }, []);

  return { ...state, send, reset };
}
