"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-5">
      {messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div key={m.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
            <div
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg",
                isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
              )}
            >
              {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                isUser
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border bg-card",
              )}
            >
              {m.pending ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  thinking
                  <span className="animate-pulse">…</span>
                </span>
              ) : isUser ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                    {m.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
