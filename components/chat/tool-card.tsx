"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProposedTool } from "@/lib/schemas/agents";

function safetyBadgeVariant(s: ProposedTool["safetyClass"]) {
  if (s === "read") return "default" as const;
  if (s === "write") return "secondary" as const;
  return "destructive" as const;
}

export function ToolCard({ tool }: { tool: ProposedTool }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <code className="font-mono text-sm">{tool.name}</code>
        <Badge variant={safetyBadgeVariant(tool.safetyClass)}>{tool.safetyClass}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{tool.doc?.purpose ?? tool.description}</p>
      {tool.inputs.length > 0 ? (
        <div className="text-xs space-y-1">
          <div className="font-medium text-muted-foreground">Inputs:</div>
          <ul className="pl-4 list-disc">
            {tool.inputs.map((i) => (
              <li key={i.name}>
                <code className="font-mono">{i.name}</code>
                <span className="text-muted-foreground"> ({i.type}{i.required ? ", required" : ""})</span>
                {i.description ? ` — ${i.description}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tool.requiredScopes.length > 0 ? (
        <div className="text-xs">
          <span className="text-muted-foreground">Scopes: </span>
          {tool.requiredScopes.map((s) => (
            <code key={s} className="font-mono mr-1">
              {s}
            </code>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
