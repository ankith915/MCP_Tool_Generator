import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-6">
      <h1 className="text-4xl font-bold">MCP Tool Generator</h1>
      <p className="text-muted-foreground">
        Fill the wizard. Download the ZIP. Boot in 2 minutes.
      </p>
      <Link
        href="/generate"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Start building →
      </Link>
    </main>
  );
}
