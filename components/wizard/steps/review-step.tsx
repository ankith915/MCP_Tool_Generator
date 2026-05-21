"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWizardForm } from "../wizard-context";
import { generateAction } from "@/server/actions/generate";
import { useState } from "react";
import { Download, ArrowLeft } from "lucide-react";

export function ReviewStep() {
  const router = useRouter();
  const { getValues, formState } = useWizardForm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = getValues();

  async function handleDownload() {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateAction(values);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // Trigger browser download
      const a = document.createElement("a");
      a.href = result.data.url;
      a.download = `${values.serverName ?? "mcp-server"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm your configuration, then download the ZIP.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-border divide-y divide-border">
        <Row label="Package name" value={values.serverName} />
        <Row label="Display name" value={values.displayName} />
        <Row label="Description" value={values.description} />
        <Row label="Version" value={values.version} />
        <Row label="Tool" value={values.tool?.name} />
        <Row label="Tool description" value={values.tool?.description} />
        <Row
          label="Parameters"
          value={
            values.tool?.parameters?.length
              ? values.tool.parameters.map((p) => p.name).join(", ")
              : "None"
          }
        />
        <Row label="Log level" value={values.logLevel} />
        <Row label="Transport" value="Streamable HTTP" />
        <Row label="Port" value={String(values.port ?? 3000)} />
        <Row label="MCP endpoint" value={values.mcpEndpoint} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">TypeScript</Badge>
        <Badge variant="secondary">@modelcontextprotocol/sdk@1.29.0</Badge>
        <Badge variant="secondary">Hono</Badge>
        <Badge variant="secondary">Pino</Badge>
        <Badge variant="secondary">Zod</Badge>
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => router.push("/generate?step=transport")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={() => void handleDownload()} disabled={isGenerating}>
          <Download className="size-4" />
          {isGenerating ? "Generating…" : "Download ZIP"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-all">{value ?? "—"}</span>
    </div>
  );
}
