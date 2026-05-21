"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  WIZARD_STEPS,
  type WizardStep,
  identityStepSchema,
  capabilitiesStepSchema,
  ioStepSchema,
  transportStepSchema,
} from "@/lib/schemas/wizard";
import { useWizardForm } from "./wizard-context";
import { MonacoPreview } from "./monaco-preview";
import { IdentityStep } from "./steps/identity-step";
import { CapabilitiesStep } from "./steps/capabilities-step";
import { IoStep } from "./steps/io-step";
import { TransportStep } from "./steps/transport-step";
import { ReviewStep } from "./steps/review-step";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const STEP_LABELS: Record<WizardStep, string> = {
  identity: "Identity",
  capabilities: "Capabilities",
  io: "I/O",
  transport: "Transport",
  review: "Review",
};

const STEP_SCHEMAS = {
  identity: identityStepSchema,
  capabilities: capabilitiesStepSchema,
  io: ioStepSchema,
  transport: transportStepSchema,
  review: null,
};

interface WizardShellProps {
  activeStep: WizardStep;
}

export function WizardShell({ activeStep }: WizardShellProps) {
  const router = useRouter();
  const form = useWizardForm();
  const activeIndex = WIZARD_STEPS.indexOf(activeStep);

  function goToStep(step: WizardStep) {
    router.push(`/generate?step=${step}`);
  }

  function handleNext() {
    const schema = STEP_SCHEMAS[activeStep];
    if (!schema) return; // review step — no validation here

    const values = form.getValues();
    const result = schema.safeParse(values);

    if (!result.success) {
      for (const issue of result.error.issues) {
        // issue.path is string | number array; join for RHF field path
        const path = issue.path.join(".") as Parameters<typeof form.setError>[0];
        form.setError(path, { message: issue.message }, { shouldFocus: true });
      }
      return;
    }

    form.clearErrors();
    const nextIndex = activeIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      goToStep(WIZARD_STEPS[nextIndex] as WizardStep);
    }
  }

  function handleBack() {
    const prevIndex = activeIndex - 1;
    if (prevIndex >= 0) {
      goToStep(WIZARD_STEPS[prevIndex] as WizardStep);
    }
  }

  const isFirst = activeIndex === 0;
  const isLast = activeStep === "review";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-4">
        <h1 className="text-lg font-semibold">MCP Tool Generator</h1>
        <span className="text-muted-foreground text-sm">
          Step {activeIndex + 1} of {WIZARD_STEPS.length}
        </span>
      </header>

      <div className="flex flex-1 w-full max-w-[1400px] mx-auto px-6 py-8 gap-6">
        {/* Sidebar step list */}
        <nav className="w-40 shrink-0 space-y-1">
          {WIZARD_STEPS.map((step, i) => {
            const done = i < activeIndex;
            const active = step === activeStep;
            return (
              <button
                key={step}
                onClick={() => {
                  // Only allow jumping back to completed steps
                  if (i <= activeIndex) goToStep(step);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : done
                      ? "text-foreground hover:bg-muted cursor-pointer"
                      : "text-muted-foreground cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-xs shrink-0",
                    active
                      ? "border-primary-foreground/30 bg-primary-foreground/10"
                      : done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {STEP_LABELS[step]}
              </button>
            );
          })}
        </nav>

        {/* Step content */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex-1 overflow-y-auto">
            {activeStep === "identity" && <IdentityStep />}
            {activeStep === "capabilities" && <CapabilitiesStep />}
            {activeStep === "io" && <IoStep />}
            {activeStep === "transport" && <TransportStep />}
            {activeStep === "review" && <ReviewStep />}
          </div>

          {/* Navigation buttons — hidden on review (ReviewStep owns its own submit) */}
          {!isLast && (
            <div className="flex items-center justify-between pt-4 border-t border-border shrink-0">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isFirst}
              >
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
              </Button>
            </div>
          )}
        </main>

        {/* Monaco live preview — always visible, updates on every form change */}
        <div className="w-[520px] shrink-0 hidden lg:flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
          <p className="text-xs font-mono text-muted-foreground mb-2">Live preview</p>
          <div className="flex-1 min-h-0">
            <MonacoPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
