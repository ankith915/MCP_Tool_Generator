import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 gap-16">
      {/* Hero */}
      <section className="max-w-3xl text-center flex flex-col items-center gap-6">
        <h1 className="text-5xl font-bold tracking-tight">MCP Tool Generator</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          The Model Context Protocol (MCP) is the open standard that lets AI
          assistants call your tools. Fill in the wizard, pick your language and
          transport, and download a production-ready ZIP — all 5 variants ship
          with traceId logging, an error envelope, input validation, a health
          endpoint, rate limiting, a Dockerfile, and GitHub Actions CI already
          wired in. No boilerplate to write. Runs in under 2&nbsp;minutes.
        </p>
        <Link href="/generate" className={buttonVariants({ size: "lg" })}>
          Start building →
        </Link>
      </section>

      {/* Feature strip */}
      <section className="w-full max-w-5xl grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>All 5 variants</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <ul className="list-disc list-inside space-y-1">
              <li>TypeScript — Streamable HTTP</li>
              <li>TypeScript — stdio</li>
              <li>Python FastMCP — Streamable HTTP</li>
              <li>Python FastMCP — stdio</li>
              <li>Python FastAPI-MCP</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standards baked in</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>traceId structured logging</li>
              <li>Consistent error envelope</li>
              <li>Zod / Pydantic input validation</li>
              <li>Health check endpoint</li>
              <li>Rate limiting</li>
              <li>Dockerfile</li>
              <li>GitHub Actions CI</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production-ready output</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Unzip, install, run:</p>
            <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
              pnpm install{"\n"}pnpm dev
            </pre>
            <p>or</p>
            <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
              pip install -r requirements.txt{"\n"}python server.py
            </pre>
            <p>It works.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
