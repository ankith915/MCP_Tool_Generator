"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWizardForm } from "../wizard-context";

export function TransportStep() {
  const {
    register,
    formState: { errors },
  } = useWizardForm();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transport</h2>
        <p className="text-sm text-muted-foreground mt-1">
          How clients connect to your MCP server.
        </p>
      </div>

      <div className="space-y-4">
        {/* Transport type — fixed for Phase 1 */}
        <div className="space-y-1.5">
          <Label>Transport type</Label>
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground">
            Streamable HTTP
            <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
              Phase 1 only
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            stdio and additional transports coming in Phase 2.
          </p>
          {/* Hidden inputs so the form values are registered */}
          <input type="hidden" {...register("language")} value="typescript" />
          <input type="hidden" {...register("framework")} value="sdk" />
          <input type="hidden" {...register("transport")} value="streamable-http" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1024}
            max={65535}
            aria-invalid={!!errors.port}
            {...register("port", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Overridable at runtime with the <code>PORT</code> env var.
          </p>
          {errors.port && (
            <p className="text-xs text-destructive">{errors.port.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mcpEndpoint">MCP endpoint path</Label>
          <Input
            id="mcpEndpoint"
            placeholder="/mcp"
            aria-invalid={!!errors.mcpEndpoint}
            {...register("mcpEndpoint")}
          />
          <p className="text-xs text-muted-foreground">
            Must start with <code>/</code>. Clients send all MCP requests here.
          </p>
          {errors.mcpEndpoint && (
            <p className="text-xs text-destructive">{errors.mcpEndpoint.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
