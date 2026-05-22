import { describe, it, expect } from "vitest";
import { runGeneratorTest, type GeneratorTestCase } from "./helpers";
import { renderProject } from "@/server/services/generate";
import type { WizardConfig } from "@/lib/schemas/wizard";

const fixture: WizardConfig = {
  serverName: "test-fastmcp-server",
  displayName: "Test FastMCP Server",
  description: "A test MCP server using Python FastMCP with streamable-http transport",
  version: "0.1.0",
  tool: {
    name: "get_greeting",
    description: "Returns a personalized greeting message for the given person name",
    parameters: [
      { name: "name", type: "string", description: "The person's name", required: true },
      { name: "formal", type: "boolean", description: "Use formal greeting", required: false },
    ],
  },
  logLevel: "info",
  language: "python",
  framework: "fastmcp",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 8765,
  mcpEndpoint: "/mcp",
};

const testCase: GeneratorTestCase = {
  name: "Python FastMCP + Streamable HTTP template",
  config: fixture,
  expectedFiles: [
    "server.py",
    "requirements.txt",
    "pyproject.toml",
    "README.md",
    ".env.example",
    "tests/test_server.py",
  ],
  contentAssertions: [
    { file: "server.py", contains: "FastMCP" },
    { file: "server.py", contains: "get_greeting" },
    { file: "requirements.txt", contains: "mcp==1.27.1" },
    { file: "requirements.txt", contains: "uvicorn" },
    // Phase 3: traceId + structlog contextvars
    { file: "server.py", contains: "trace_id" },
    { file: "server.py", contains: "structlog.contextvars" },
    // Phase 3: healthz + rate limit
    { file: "server.py", contains: "/healthz" },
    { file: "server.py", contains: "_RateLimitMiddleware" },
    // Phase 3: error envelope + new entrypoint
    { file: "server.py", contains: "TOOL_ERROR" },
    { file: "server.py", contains: "streamable_http_app" },
  ],
  toolchain: {
    installCmd: ["uv", "sync"],
    testCmd: ["uv", "run", "pytest"],
    timeoutMs: 300_000,
    bootCheck: {
      startCmd: ["uv", "run", "python", "server.py"],
      probeUrl: "http://localhost:8765/healthz",
      expectedStatuses: [200],
      startupMs: 15_000,
      pollIntervalMs: 500,
    },
  },
};

describe("Python FastMCP + Streamable HTTP template", () => {
  it("renders, installs, tests, and boots successfully", async () => {
    // Negative assertion: streamable-http server.py must NOT contain "stdio"
    const files = await renderProject(fixture);
    const serverContent = files["server.py"] ?? "";
    expect(serverContent, "server.py must not contain stdio").not.toContain("stdio");

    await runGeneratorTest(testCase);
  });
});
