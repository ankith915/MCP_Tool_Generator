import { Suspense } from "react";
import { WizardPage } from "@/components/wizard/wizard-page";

export const metadata = {
  title: "Generate MCP Server — MCP Tool Generator",
};

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading wizard…</div>}>
      <WizardPage />
    </Suspense>
  );
}
