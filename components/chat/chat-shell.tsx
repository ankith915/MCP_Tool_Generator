"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCode2, Loader2, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CodeWorkspace } from "./code-workspace";
import { Composer, type ComposerAttachment } from "./composer";
import { MessageList, type ChatMessage } from "./message-list";
import { PromptGuide } from "./prompt-guide";
import { PlanReview } from "./plan-review";
import { ThinkingPanel } from "./thinking-panel";
import { ViolationBanner } from "./violation-banner";
import { useChatStream } from "./use-chat-stream";
import { useGenerateStream } from "./use-generate-stream";
import type { ClarificationTurnResult, PlanProposal } from "@/lib/schemas/agents";

interface Props {
  initialSessionId?: string;
}

export function ChatShell({ initialSessionId }: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<PlanProposal | null>(null);
  const [turnInfo, setTurnInfo] = useState<ClarificationTurnResult | null>(null);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const creatingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClarification = useCallback((r: ClarificationTurnResult) => {
    setTurnInfo(r);
    const text = r.nextQuestion ?? "Got everything I need — drafting your plan now.";
    setMessages((prev) => [
      ...prev,
      { id: `c-${prev.length}`, role: "assistant", content: text },
    ]);
  }, []);

  // We need a stable reference to `generate.reset` so handlePlan's deps don't
  // re-build on every render (the hook returns a fresh state object each time).
  // Captured below from the destructured hook return.
  const generateResetRef = useRef<() => void>(() => {});

  const handlePlan = useCallback((p: PlanProposal) => {
    setPlan(p);
    // A new plan arriving after a generation means the user just refined.
    // Reset the workspace stream so the right pane flips back from
    // CodeWorkspace to PlanReview (Approve & regenerate from the new plan).
    generateResetRef.current();
    setMessages((prev) => [
      ...prev,
      {
        id: `p-${prev.length}`,
        role: "assistant",
        content: `Plan drafted for **${p.serverName}** with ${p.tools.length} tool(s). Review it on the right, then approve to generate.`,
      },
    ]);
  }, []);

  const { send, phase, isStreaming, error, reasoningText } = useChatStream({
    onClarification: handleClarification,
    onPlan: handlePlan,
  });

  const generate = useGenerateStream({
    onDone: (artifactUrl) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `g-${prev.length}`,
          role: "assistant",
          content:
            `Generated. [Download the ZIP](${artifactUrl}) or browse the files on the right.\n\n` +
            `Want any changes? Just describe them — e.g. _"add a delete_order tool"_ or ` +
            `_"move tools under src/tools/"_ — and I'll refine the plan.`,
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ge-${prev.length}`,
          role: "assistant",
          content: `Generation failed: ${err.message}`,
        },
      ]);
    },
  });

  // Sync the stable ref so handlePlan (declared above) can reach generate.reset
  // without circular deps. useEffect runs after render — safe for refs.
  useEffect(() => {
    generateResetRef.current = generate.reset;
  });

  const handleGenerate = useCallback(() => {
    if (!sessionId) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `gs-${prev.length}`,
        role: "assistant",
        content: "Approved. Streaming the project into the workspace…",
      },
    ]);
    void generate.send({ sessionId });
  }, [sessionId, generate]);

  useEffect(() => {
    if (sessionId || creatingRef.current) return;
    creatingRef.current = true;
    fetch("/api/v1/chat/sessions", { method: "POST" })
      .then((r) => r.json())
      .then((body) => {
        if (body.ok) {
          setSessionId(body.data.sessionId);
          router.replace(`/generate/chat/${body.data.sessionId}`);
        } else {
          creatingRef.current = false;
        }
      })
      .catch(() => {
        creatingRef.current = false;
      });
  }, [sessionId, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!sessionId || !content || isStreaming) return;
    // What we display in the chat bubble: the user's actual prompt, with a
    // tiny "📎 attached" hint when applicable. The full extracted text goes
    // to the server but doesn't clutter the conversation.
    const displayContent = attachment
      ? `${content}\n\n📎 _${attachment.filename}_`
      : content;
    setMessages((prev) => [
      ...prev,
      { id: `u-${prev.length}`, role: "user", content: displayContent },
    ]);
    setDraft("");
    const attachmentText = attachment?.text ?? undefined;
    const attachmentName = attachment?.filename ?? undefined;
    setAttachment(null);
    void send({ sessionId, content, attachmentText, attachmentName });
  }, [draft, attachment, sessionId, isStreaming, send]);

  const phaseLabel =
    phase === "clarifying"
      ? "Clarifying your requirements…"
      : phase === "planning"
        ? "Drafting the plan…"
        : null;

  const showGuide = messages.length === 0 && !isStreaming;
  const hasWorkspaceNotes =
    !!turnInfo &&
    ((turnInfo.violations?.length ?? 0) > 0 || (turnInfo.advisories?.length ?? 0) > 0);
  // Once generation has started, the workspace pane is dedicated to the live
  // file tree + editor — the plan-review approve flow has already done its job.
  const showLiveWorkspace = generate.status !== "idle";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b px-5 py-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">MCP Tool Generator — Chat</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Describe your server in plain English — planned to the MCP best-practice standard, then generated.
          </p>
        </div>
        <Link
          href="/generate/chat"
          prefetch={false}
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto`}
        >
          New chat
        </Link>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <section className="flex min-h-0 flex-col md:border-r">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            {!sessionId ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Starting a new session…
              </div>
            ) : showGuide ? (
              <PromptGuide onUseExample={(t) => setDraft(t)} />
            ) : (
              <>
                <MessageList messages={messages} />
                <div className="mt-4 space-y-3">
                  <ThinkingPanel
                    text={reasoningText}
                    active={phase === "planning" && isStreaming}
                  />
                  {isStreaming && phase === "clarifying" ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {phaseLabel}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
          {error ? (
            <div className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error.code}: {error.message}
            </div>
          ) : null}
          <div className="border-t p-3">
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              disabled={!sessionId || isStreaming}
              attachment={attachment}
              onAttachmentChange={setAttachment}
            />
          </div>
        </section>

        <section className="hidden min-h-0 flex-col overflow-hidden bg-muted/30 md:flex">
          {showLiveWorkspace ? (
            <CodeWorkspace state={generate} />
          ) : (
            <>
              <div className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Workspace
              </div>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {hasWorkspaceNotes ? (
                  <ViolationBanner
                    violations={turnInfo!.violations ?? []}
                    advisories={turnInfo!.advisories ?? []}
                  />
                ) : null}
                {plan && sessionId ? (
                  <PlanReview
                    sessionId={sessionId}
                    plan={plan}
                    onGenerate={handleGenerate}
                  />
                ) : !hasWorkspaceNotes ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
                    <FileCode2 className="size-8 text-muted-foreground/60" />
                    <p className="mt-3 text-sm font-medium">Your generated server will appear here</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Answer a few questions and I’ll draft a plan, then stream the project files
                      live into this panel.
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
