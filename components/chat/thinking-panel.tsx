"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Live-updating reasoning text from the plan model. Empty string when none yet. */
  text: string;
  /** True while the planning step is in flight — drives the pulse animation. */
  active: boolean;
}

/**
 * Collapsible panel that surfaces the plan model's reasoning summary
 * (`o4-mini`'s "thinking"). Auto-expands while reasoning is streaming so the
 * user sees it live; the user can collapse it after.
 */
export function ThinkingPanel({ text, active }: Props) {
  // Expanded by default so streaming reasoning is visible immediately; the
  // user can collapse if they want a quieter chat. Respecting their toggle
  // is intentionally simpler than auto-expand-on-new-delta (which would
  // trigger cascading renders).
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the scroll pinned to the bottom while text streams in.
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [text, collapsed]);

  if (!active && !text) return null;

  return (
    <div className="rounded-xl border bg-card/60 text-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <div
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            active
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {active ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Brain className="size-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">
            {active ? "Thinking…" : "Reasoning"}
          </div>
          {collapsed && text ? (
            <div className="truncate text-xs text-muted-foreground">
              {text.slice(-160).split("\n").pop()}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            collapsed ? "" : "rotate-180",
          )}
        />
      </button>
      {!collapsed ? (
        <div
          ref={scrollRef}
          className="max-h-72 overflow-y-auto border-t px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {text || (
            <span className="italic">
              Reasoning will appear here as the plan model thinks…
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
