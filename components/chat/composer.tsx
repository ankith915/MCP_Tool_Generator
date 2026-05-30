"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Paperclip, Send, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ComposerAttachment {
  filename: string;
  size: number;
  /** Extracted, redacted, length-capped text from the upload route. */
  text: string;
  wasTruncated: boolean;
  redactedCount: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  attachment: ComposerAttachment | null;
  onAttachmentChange: (a: ComposerAttachment | null) => void;
}

const ACCEPT = ".pdf,.docx,.md,.markdown,.txt";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  attachment,
  onAttachmentChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/chat/upload", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!body.ok) {
        setUploadError(body.error?.message ?? "Upload failed");
        return;
      }
      onAttachmentChange({
        filename: body.data.filename,
        size: body.data.size,
        text: body.data.text,
        wasTruncated: body.data.wasTruncated,
        redactedCount: body.data.redactedCount,
      });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      {attachment ? (
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{attachment.filename}</span>
          <span className="shrink-0 text-muted-foreground">
            · {humanSize(attachment.size)}
            {attachment.wasTruncated ? " · truncated" : ""}
            {attachment.redactedCount > 0
              ? ` · ${attachment.redactedCount} secret${attachment.redactedCount === 1 ? "" : "s"} redacted`
              : ""}
          </span>
          <button
            type="button"
            onClick={() => onAttachmentChange(null)}
            className="ml-auto grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {uploadError ? (
        <div className="flex items-center gap-2 border-b bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="truncate">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="ml-auto"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder="Describe the MCP server you want to build…"
        disabled={disabled}
        className="min-h-[3.5rem] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />

      <div className="flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a PDF, Word, or Markdown file"
            title="Attach a PDF, Word, or Markdown file"
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Paperclip className="size-3.5" />
            )}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            for a new line
          </span>
        </div>
        <Button
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          size="sm"
        >
          <Send className="size-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}
