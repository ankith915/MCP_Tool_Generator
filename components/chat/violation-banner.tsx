"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Advisory } from "@/lib/schemas/agents";
import type { Violation } from "@/lib/agents/validators/types";

interface Props {
  violations: Violation[];
  advisories: Advisory[];
}

function severityBadge(sev: Advisory["severity"]) {
  if (sev === "warning") return "destructive" as const;
  if (sev === "suggestion") return "secondary" as const;
  return "default" as const;
}

export function ViolationBanner({ violations, advisories }: Props) {
  if (violations.length === 0 && advisories.length === 0) return null;
  return (
    <Card className="p-3 space-y-3">
      {violations.length > 0 ? (
        <div className="space-y-1">
          <div className="text-sm font-medium text-destructive">
            Playbook violations ({violations.length})
          </div>
          <ul className="text-xs space-y-1">
            {violations.map((v, i) => (
              <li key={i} className="flex gap-2">
                <Badge variant="destructive">{v.code}</Badge>
                <span className="text-muted-foreground font-mono">{v.path}</span>
                {v.section ? <span className="text-muted-foreground">{v.section}</span> : null}
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {advisories.length > 0 ? (
        <div className="space-y-1">
          <div className="text-sm font-medium">Advisories ({advisories.length})</div>
          <ul className="text-xs space-y-1">
            {advisories.map((a, i) => (
              <li key={i} className="flex gap-2">
                <Badge variant={severityBadge(a.severity)}>{a.topic}</Badge>
                {a.path ? <span className="text-muted-foreground font-mono">{a.path}</span> : null}
                <span>{a.message}</span>
                {a.section ? <span className="text-muted-foreground">{a.section}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
