"use client";

import { type ReactNode } from "react";
import {
  FormProvider,
  useForm,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { type WizardConfig } from "@/lib/schemas/wizard";

const DEFAULT_VALUES: Partial<WizardConfig> = {
  version: "0.1.0",
  tool: {
    name: "",
    description: "",
    parameters: [],
  },
  logLevel: "info",
  language: "typescript",
  framework: "sdk",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 3000,
  mcpEndpoint: "/mcp",
};

export function WizardProvider({ children }: { children: ReactNode }) {
  // No global resolver — each wizard step validates its own sub-schema via
  // form.setError() in WizardShell.handleNext(). Using a full-schema resolver
  // here would flag errors on future steps before they've been filled.
  const form = useForm<WizardConfig>({
    defaultValues: DEFAULT_VALUES as WizardConfig,
    mode: "onTouched",
  });

  // FormProvider wires up RHF's internal subscription so setError() in
  // WizardShell triggers re-renders in child step components.
  return <FormProvider {...form}>{children}</FormProvider>;
}

export function useWizardForm(): UseFormReturn<WizardConfig> {
  return useFormContext<WizardConfig>();
}
