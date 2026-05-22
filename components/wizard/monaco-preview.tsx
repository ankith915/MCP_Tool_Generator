"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWizardForm } from "./wizard-context";
import { previewAction } from "@/server/actions/preview";
import { getPrimaryFile } from "@/lib/schemas/wizard";
import type { WizardConfig } from "@/lib/schemas/wizard";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; code: string }
  | { status: "error" };

export function MonacoPreview() {
  const { watch } = useWizardForm();
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [editorLanguage, setEditorLanguage] = useState<"typescript" | "python">("typescript");
  const [editorFramework, setEditorFramework] = useState<WizardConfig["framework"]>("sdk");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { unsubscribe } = watch((values) => {
      // Keep the Monaco syntax highlighting in sync with the selected language
      setEditorLanguage(values.language === "python" ? "python" : "typescript");
      setEditorFramework(values.framework ?? "sdk");

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setPreview({ status: "loading" });
        const result = await previewAction(values as WizardConfig);
        if (result.ok) {
          setPreview({ status: "ready", code: result.data.code });
        } else {
          setPreview({ status: "error" });
        }
      }, 300);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watch]);

  // Derive a human-friendly filename for the preview header
  const previewFilename = getPrimaryFile(editorLanguage, editorFramework);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 shrink-0">
        <span className="text-xs font-mono text-muted-foreground">{previewFilename}</span>
        {preview.status === "loading" && (
          <span className="text-xs text-muted-foreground animate-pulse">Rendering…</span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {preview.status === "ready" ? (
          <MonacoEditor
            height="100%"
            language={editorLanguage}
            value={preview.code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: "on",
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
            {preview.status === "idle" && (
              <p className="text-xs text-zinc-500 font-mono">
                Fill in the form to see a preview.
              </p>
            )}
            {preview.status === "loading" && <EditorLoadingDots />}
            {preview.status === "error" && (
              <p className="text-xs text-zinc-500 font-mono">
                Complete required fields to preview.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="h-full bg-[#1e1e1e] flex items-center justify-center">
      <EditorLoadingDots />
    </div>
  );
}

function EditorLoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-zinc-600 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
