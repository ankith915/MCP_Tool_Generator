"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToolCard } from "./tool-card";
import type { PlanProposal } from "@/lib/schemas/agents";

interface Props {
  sessionId: string;
  plan: PlanProposal;
  /** Triggered after /approve succeeds; the parent opens the SSE generate stream. */
  onGenerate: () => void;
}

export function PlanReview({ sessionId, plan, onGenerate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBlockingViolations = plan.violations.length > 0;

  async function approveAndGenerate() {
    setBusy(true);
    setError(null);
    try {
      const approveRes = await fetch("/api/v1/chat/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const approveBody = await approveRes.json();
      if (!approveBody.ok) {
        setError(approveBody.error?.message ?? "Approve failed");
        return;
      }
      onGenerate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
            <code className="font-mono text-base">{plan.serverName}</code>
          </div>
          <Badge variant={hasBlockingViolations ? "destructive" : "default"}>
            {hasBlockingViolations
              ? `${plan.violations.length} violation${plan.violations.length === 1 ? "" : "s"}`
              : "Clean"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
      </Card>

      {plan.violations.length > 0 ? (
        <Card className="p-3 space-y-1 border-destructive/40">
          <div className="text-sm font-medium text-destructive">Violations to resolve</div>
          <ul className="text-xs space-y-1">
            {plan.violations.map((v, i) => (
              <li key={i} className="flex gap-2">
                <Badge variant="destructive">{v.code}</Badge>
                <code className="font-mono text-muted-foreground">{v.path}</code>
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-medium">Tools ({plan.tools.length})</div>
        <div className="space-y-2">
          {plan.tools.map((t) => (
            <ToolCard key={t.name} tool={t} />
          ))}
        </div>
      </div>

      {plan.verificationChecklist.length > 0 ? (
        <Card className="p-3 space-y-1">
          <div className="text-sm font-medium">Verification checklist</div>
          <ul className="text-xs list-disc pl-4 space-y-1">
            {plan.verificationChecklist.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button
        onClick={approveAndGenerate}
        disabled={busy || hasBlockingViolations}
        variant={hasBlockingViolations ? "outline" : "default"}
      >
        {busy
          ? "Approving…"
          : hasBlockingViolations
            ? "Resolve violations to continue"
            : "Approve and generate"}
      </Button>
    </div>
  );
}
