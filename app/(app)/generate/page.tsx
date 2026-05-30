import { Suspense } from "react";
import Link from "next/link";
import { WizardPage } from "@/components/wizard/wizard-page";

export const metadata = {
  title: "Generate MCP Server — MCP Tool Generator",
};

export default function GeneratePage() {
  return (
    <>
      <div className="border-b bg-muted/30 px-4 py-2 text-xs text-center text-muted-foreground">
        Form wizard. Prefer a guided, playbook-enforcing experience?{" "}
        <Link
          href="/generate/chat"
          className="text-primary underline-offset-4 hover:underline"
        >
          Chat with the agent →
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen text-muted-foreground">
            Loading wizard…
          </div>
        }
      >
        <WizardPage />
      </Suspense>
    </>
  );
}
