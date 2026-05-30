"use client";

import { Sparkles, Lightbulb, ArrowRight } from "lucide-react";

const TEMPLATE_LINES = [
  ["Server", "what it does in one sentence (name ends in -mcp)"],
  ["Tools", "for each: name(params) → what it returns, and read / write / destructive"],
  ["Data & services", "databases or external APIs it talks to"],
  ["Auth & scopes", "who may call it and the scopes each tool needs"],
  ["Stack (optional)", "TypeScript or Python · Streamable HTTP or stdio"],
] as const;

const EXAMPLES: { title: string; prompt: string }[] = [
  {
    title: "Read-only orders service",
    prompt:
      "Build a read-only orders-mcp server. Tools: get_order(order_id) returns an order with status and line items; list_shipments(order_id) returns shipments with pagination. Data source: internal Postgres orders_db. Scopes: orders:read.",
  },
  {
    title: "GitHub issues (read + write)",
    prompt:
      "I need a github-issues-mcp. Tools: search_issues(query), get_issue(number), and create_issue(title, body) which is a write tool and must be idempotent. External service: the GitHub REST API, authenticated with a token. Scopes: issues:read, issues:write.",
  },
  {
    title: "Weather in Python (FastMCP)",
    prompt:
      "Create a weather-mcp using Python FastMCP over stdio. Tools: get_current(city) and get_forecast(city, days). Public data, read-only. External service: a weather HTTP API.",
  },
];

export function PromptGuide({ onUseExample }: { onUseExample: (text: string) => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col items-center text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Describe the MCP server you want</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The more detail you give, the better the plan. Follow this template:
        </p>
      </div>

      <div className="mt-5 rounded-xl border bg-card p-4">
        <dl className="space-y-2.5">
          {TEMPLATE_LINES.map(([term, desc]) => (
            <div key={term} className="flex gap-3 text-sm">
              <dt className="w-28 shrink-0 font-medium text-foreground">{term}</dt>
              <dd className="text-muted-foreground">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Lightbulb className="size-3.5" />
          Or start from an example
        </div>
        <div className="space-y-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.title}
              type="button"
              onClick={() => onUseExample(ex.prompt)}
              className="group flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{ex.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ex.prompt}</div>
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
