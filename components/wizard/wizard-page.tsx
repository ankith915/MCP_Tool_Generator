"use client";

import { useSearchParams } from "next/navigation";
import { WizardProvider } from "./wizard-context";
import { WizardShell } from "./wizard-shell";
import { WIZARD_STEPS, type WizardStep } from "@/lib/schemas/wizard";

function isWizardStep(value: string | null): value is WizardStep {
  return WIZARD_STEPS.includes(value as WizardStep);
}

export function WizardPage() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const activeStep: WizardStep = isWizardStep(stepParam) ? stepParam : "identity";

  return (
    <WizardProvider>
      <WizardShell activeStep={activeStep} />
    </WizardProvider>
  );
}
