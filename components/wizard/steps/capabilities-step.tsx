"use client";

import { useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWizardForm } from "../wizard-context";

const TYPE_OPTIONS = ["string", "number", "boolean"] as const;

export function CapabilitiesStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useWizardForm();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tool.parameters",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Capabilities</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define the one tool your MCP server exposes.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tool.name">Tool name</Label>
          <Input
            id="tool.name"
            placeholder="get_data"
            aria-invalid={!!errors.tool?.name}
            {...register("tool.name")}
          />
          <p className="text-xs text-muted-foreground">
            snake_case. This is the name LLMs use to call your tool.
          </p>
          {errors.tool?.name && (
            <p className="text-xs text-destructive">{errors.tool.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tool.description">Tool description</Label>
          <textarea
            id="tool.description"
            rows={3}
            placeholder="Fetches real-time weather data for a given city. Returns temperature, conditions, and wind speed."
            aria-invalid={!!errors.tool?.description}
            className={cn(
              "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-none transition-colors",
              "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              errors.tool?.description && "border-destructive ring-3 ring-destructive/20",
            )}
            {...register("tool.description")}
          />
          <p className="text-xs text-muted-foreground">
            Be action-oriented and concrete. At least 10 characters.
          </p>
          {errors.tool?.description && (
            <p className="text-xs text-destructive">{errors.tool.description.message}</p>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Parameters</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ name: "", type: "string", description: "", required: true })
            }
          >
            <Plus className="size-3.5" />
            Add parameter
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
            No parameters — your tool takes no input.
          </p>
        )}

        {fields.map((field, i) => (
          <div
            key={field.id}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parameter {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`p-name-${i}`} className="text-xs">Name</Label>
                <Input
                  id={`p-name-${i}`}
                  placeholder="query"
                  size={1}
                  aria-invalid={!!errors.tool?.parameters?.[i]?.name}
                  {...register(`tool.parameters.${i}.name`)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`p-type-${i}`} className="text-xs">Type</Label>
                <select
                  id={`p-type-${i}`}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register(`tool.parameters.${i}.type`)}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`p-desc-${i}`} className="text-xs">Description</Label>
              <Input
                id={`p-desc-${i}`}
                placeholder="What this parameter represents"
                aria-invalid={!!errors.tool?.parameters?.[i]?.description}
                {...register(`tool.parameters.${i}.description`)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                {...register(`tool.parameters.${i}.required`)}
              />
              Required
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
