"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-zinc-600 animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  ),
});

interface GalleryCardProps {
  title: string;
  filename: string;
  language: "typescript" | "python";
  code: string;
}

export function GalleryCard({ title, filename, language, code }: GalleryCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50 shrink-0">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs font-mono text-muted-foreground">{filename}</span>
      </div>
      <div className="h-[480px]">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
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
      </div>
    </div>
  );
}
