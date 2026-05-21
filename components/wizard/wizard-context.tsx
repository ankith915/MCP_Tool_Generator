"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
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
  port: 3000,
  mcpEndpoint: "/mcp",
};

type WizardContextValue = {
  form: UseFormReturn<WizardConfig>;
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  // No global resolver — each wizard step validates its own sub-schema via
  // form.setError() in WizardShell.handleNext(). Using a full-schema resolver
  // here would flag errors on future steps before they've been filled.
  const form = useForm<WizardConfig>({
    defaultValues: DEFAULT_VALUES as WizardConfig,
    mode: "onTouched",
  });

  return (
    <WizardContext.Provider value={{ form }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizardForm(): UseFormReturn<WizardConfig> {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizardForm must be used inside WizardProvider");
  return ctx.form;
}
