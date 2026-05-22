"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWizardForm } from "../wizard-context";

// ---------------------------------------------------------------------------
// Option arrays
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS = [
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
] as const;

const FRAMEWORK_OPTIONS = [
  { value: "fastmcp", label: "FastMCP", description: "Official Python MCP SDK" },
  {
    value: "fastapi-mcp",
    label: "FastAPI-MCP",
    description: "Attach MCP to an existing FastAPI app",
  },
] as const;

const TRANSPORT_OPTIONS = [
  { value: "streamable-http", label: "Streamable HTTP", description: "Clients connect over HTTP" },
  { value: "stdio", label: "stdio", description: "Clients launch the server as a subprocess" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransportStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useWizardForm();

  const language = watch("language");
  const framework = watch("framework");
  const transport = watch("transport");

  // When the user switches to Python, default to fastmcp framework
  useEffect(() => {
    if (language === "python" && framework === "sdk") {
      setValue("framework", "fastmcp", { shouldValidate: false });
    }
  }, [language, framework, setValue]);

  // When the user switches back to TypeScript, reset framework to sdk
  useEffect(() => {
    if (language === "typescript" && framework !== "sdk") {
      setValue("framework", "sdk", { shouldValidate: false });
    }
  }, [language, framework, setValue]);

  // When fastapi-mcp is selected, force transport to streamable-http
  useEffect(() => {
    if (framework === "fastapi-mcp" && transport !== "streamable-http") {
      setValue("transport", "streamable-http", { shouldValidate: false });
    }
  }, [framework, transport, setValue]);

  const showFrameworkSelector = language === "python";
  const showTransportSelector = framework !== "fastapi-mcp";
  const showHttpFields = transport === "streamable-http";
  const showExistingFastapiCheckbox = framework === "fastapi-mcp";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transport</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the language, framework, and how clients connect to your MCP server.
        </p>
      </div>

      <div className="space-y-6">
        {/* Language selector */}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Language
          </legend>
          <div className="flex flex-col gap-2 mt-1.5">
            {LANGUAGE_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <input
                  type="radio"
                  value={value}
                  className="accent-primary h-4 w-4 shrink-0"
                  {...register("language")}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {errors.language && (
            <p className="text-xs text-destructive">{errors.language.message}</p>
          )}
        </fieldset>

        {/* Framework selector — Python only */}
        {showFrameworkSelector && (
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Framework
            </legend>
            <div className="flex flex-col gap-2 mt-1.5">
              {FRAMEWORK_OPTIONS.map(({ value, label, description }) => (
                <label
                  key={value}
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    value={value}
                    className="accent-primary h-4 w-4 shrink-0 mt-0.5"
                    {...register("framework")}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.framework && (
              <p className="text-xs text-destructive">{errors.framework.message}</p>
            )}
          </fieldset>
        )}

        {/* Hidden framework field for TypeScript (always "sdk") */}
        {!showFrameworkSelector && (
          <input type="hidden" {...register("framework")} />
        )}

        {/* Transport selector — hidden for fastapi-mcp (forces streamable-http) */}
        {showTransportSelector ? (
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Transport
            </legend>
            <div className="flex flex-col gap-2 mt-1.5">
              {TRANSPORT_OPTIONS.map(({ value, label, description }) => (
                <label
                  key={value}
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    value={value}
                    className="accent-primary h-4 w-4 shrink-0 mt-0.5"
                    {...register("transport")}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.transport && (
              <p className="text-xs text-destructive">{errors.transport.message}</p>
            )}
          </fieldset>
        ) : (
          /* Hidden transport field for fastapi-mcp (always "streamable-http") */
          <input type="hidden" {...register("transport")} />
        )}

        {/* Port — Streamable HTTP only */}
        {showHttpFields && (
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
        )}

        {/* MCP endpoint — Streamable HTTP only */}
        {showHttpFields && (
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
        )}

        {/* Existing FastAPI service checkbox — fastapi-mcp only */}
        {showExistingFastapiCheckbox && (
          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary h-4 w-4 shrink-0 mt-0.5"
                {...register("existingFastapiService")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">I have an existing FastAPI service</span>
                <span className="text-xs text-muted-foreground">
                  The generator will produce a <code>FastApiMCP(app)</code> wiring snippet
                  that attaches to your existing app rather than scaffolding a new one.
                </span>
              </span>
            </label>
            {errors.existingFastapiService && (
              <p className="text-xs text-destructive">{errors.existingFastapiService.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
