"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FileTree } from "./file-tree";
import type { GenerateState } from "./use-generate-stream";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => null },
);

function languageFor(path: string): string {
  if (path.endsWith(".py") || path.endsWith(".py.eta")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith("Dockerfile")) return "dockerfile";
  return "plaintext";
}

function stageLabel(state: GenerateState): string | null {
  if (state.status === "idle") return null;
  if (state.status === "error") return state.error?.message ?? "Generation failed";
  if (state.stage === "rendering") return "Rendering files…";
  if (state.stage === "zipping") return "Packaging ZIP…";
  if (state.stage === "done" || state.status === "done") {
    return `Generated ${state.order.length} files`;
  }
  return "Generating…";
}

export function CodeWorkspace({ state }: { state: GenerateState }) {
  // Override active selection when the user clicks a file in the tree.
  const [override, setOverride] = useState<string | null>(null);
  const selected = override ?? state.activePath ?? state.order[0] ?? null;

  const active = selected ? state.files[selected] : null;
  const label = stageLabel(state);

  const content = useMemo(() => active?.content ?? "", [active]);
  const language = useMemo(
    () => (selected ? languageFor(selected) : "plaintext"),
    [selected],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — phase / file count / download */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          {state.status === "streaming" ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
          <span
            className={
              state.status === "error"
                ? "font-medium text-destructive"
                : "font-medium uppercase tracking-wide text-muted-foreground"
            }
          >
            {label ?? "Workspace"}
          </span>
        </div>
        {state.artifactUrl ? (
          <a
            href={state.artifactUrl}
            download
            className={`${buttonVariants({ variant: "default", size: "sm" })}`}
          >
            <Download className="size-3.5" />
            Download ZIP
          </a>
        ) : null}
      </div>

      {/* Body — file tree (left) + editor (right) */}
      <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)]">
        <div className="min-h-0 border-r">
          <FileTree
            files={state.files}
            order={state.order}
            activePath={selected}
            onSelect={(p) => setOverride(p)}
          />
        </div>
        <div className="min-h-0 overflow-hidden">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="border-b bg-muted/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                {selected}
              </div>
              <div className="min-h-0 flex-1">
                <MonacoEditor
                  height="100%"
                  language={language}
                  value={content}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily:
                      "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: "on",
                    renderWhitespace: "none",
                    folding: false,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a file from the tree to preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
