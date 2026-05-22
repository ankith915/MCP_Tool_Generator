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
    { file: "server.py", contains: "streamable-http" },
    { file: "requirements.txt", contains: "mcp==1.27.1" },
    { file: "requirements.txt", contains: "uvicorn" },
  ],
  toolchain: {
    installCmd: ["uv", "sync"],
    testCmd: ["uv", "run", "pytest"],
    // No buildCmd for Python
    // No bootCheck — boot-check can be added later; install+test is sufficient for now
    timeoutMs: 300_000,
  },
};

describe("Python FastMCP + Streamable HTTP template", () => {
  it("renders, installs, and tests successfully", async () => {
    // Negative assertion: streamable-http server.py must NOT contain "stdio"
    const files = await renderProject(fixture);
    const serverContent = files["server.py"] ?? "";
    expect(serverContent, "server.py must not contain stdio").not.toContain("stdio");

    await runGeneratorTest(testCase);
  });
});
