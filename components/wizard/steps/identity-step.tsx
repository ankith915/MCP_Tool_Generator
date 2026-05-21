"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWizardForm } from "../wizard-context";

export function IdentityStep() {
  const {
    register,
    formState: { errors },
  } = useWizardForm();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Identity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Basic information about your MCP server.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="serverName">Package name</Label>
          <Input
            id="serverName"
            placeholder="my-mcp-server"
            aria-invalid={!!errors.serverName}
            {...register("serverName")}
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, digits, hyphens. Used as the npm package name.
          </p>
          {errors.serverName && (
            <p className="text-xs text-destructive">{errors.serverName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            placeholder="My MCP Server"
            aria-invalid={!!errors.displayName}
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="text-xs text-destructive">{errors.displayName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="What does this MCP server do?"
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            placeholder="0.1.0"
            aria-invalid={!!errors.version}
            {...register("version")}
          />
          {errors.version && (
            <p className="text-xs text-destructive">{errors.version.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
