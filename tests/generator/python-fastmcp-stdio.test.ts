import { describe, it, expect } from "vitest";
import { runGeneratorTest, type GeneratorTestCase } from "./helpers";
import { renderProject } from "@/server/services/generate";
import type { WizardConfig } from "@/lib/schemas/wizard";

const fixture: WizardConfig = {
  serverName: "test-fastmcp-stdio-server",
  displayName: "Test FastMCP Stdio Server",
  description: "A test MCP server using Python FastMCP with stdio transport",
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
  transport: "stdio",
  existingFastapiService: false,
  port: 3000,      // ignored by stdio, but required by schema
  mcpEndpoint: "/mcp", // ignored by stdio, but required by schema
};

const testCase: GeneratorTestCase = {
  name: "Python FastMCP + stdio template",
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
    { file: "server.py", contains: "stdio" },
    { file: "requirements.txt", contains: "mcp==1.27.1" },
  ],
  toolchain: {
    installCmd: ["uv", "sync"],
    testCmd: ["uv", "run", "pytest"],
    // No buildCmd for Python
    // No bootCheck — stdio has no HTTP endpoint to probe
    timeoutMs: 300_000,
  },
};

describe("Python FastMCP + stdio template", () => {
  it("renders, installs, and tests successfully", async () => {
    // Negative assertions: stdio server.py must NOT contain "streamable-http" or "uvicorn"
    const files = await renderProject(fixture);
    const serverContent = files["server.py"] ?? "";
    const requirementsContent = files["requirements.txt"] ?? "";

    expect(serverContent, "server.py must not contain streamable-http").not.toContain("streamable-http");
    expect(requirementsContent, "requirements.txt must not contain uvicorn").not.toContain("uvicorn");

    await runGeneratorTest(testCase);
  });
});
