"use client";

import { Label } from "@/components/ui/label";
import { useWizardForm } from "../wizard-context";

const LOG_LEVELS = [
  { value: "debug", label: "Debug — verbose, dev only" },
  { value: "info", label: "Info — normal operations (recommended)" },
  { value: "warn", label: "Warn — recoverable issues only" },
  { value: "error", label: "Error — failures only" },
] as const;

export function IoStep() {
  const {
    register,
    formState: { errors },
  } = useWizardForm();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">I/O</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Logging and observability settings for your server.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="logLevel">Log level</Label>
          <select
            id="logLevel"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register("logLevel")}
          >
            {LOG_LEVELS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The Pino logger respects <code>LOG_LEVEL</code> env var at runtime — this sets the default.
          </p>
          {errors.logLevel && (
            <p className="text-xs text-destructive">{errors.logLevel.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
