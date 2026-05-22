import { describe, it, expect } from "vitest";
import type { WizardConfig } from "@/lib/schemas/wizard";
import { renderProject } from "@/server/services/generate";
import { runGeneratorTest } from "./helpers";

const fixture: WizardConfig = {
  serverName: "test-fastapi-mcp-server",
  displayName: "Test FastAPI MCP Server",
  description: "A test FastAPI app with MCP tools exposed via fastapi-mcp",
  version: "0.1.0",
  tool: {
    name: "create_item",
    description: "Creates a new item with the given name and optional description",
    parameters: [
      { name: "item_name", type: "string", description: "The item name", required: true },
      { name: "description", type: "string", description: "Item description", required: false },
    ],
  },
  logLevel: "info",
  language: "python",
  framework: "fastapi-mcp",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 8766,
  mcpEndpoint: "/mcp",
};

describe("python/fastapi-mcp/streamable-http generator", () => {
  it(
    "renders, installs, and tests a FastAPI-MCP project",
    async () => {
      // Negative assertions on rendered output before full pipeline
      const files = await renderProject(fixture);
      const mainContent = files["main.py"] ?? "";
      expect(mainContent, "main.py must not contain StdioServerTransport").not.toContain(
        "StdioServerTransport",
      );
      expect(mainContent, "main.py must not contain mcp.run(transport=").not.toContain(
        'mcp.run(transport=',
      );

      await runGeneratorTest({
        name: "python-fastapi-mcp-streamable-http",
        config: fixture,
        expectedFiles: [
          "main.py",
          "requirements.txt",
          "pyproject.toml",
          "README.md",
          ".env.example",
          "tests/test_main.py",
        ],
        contentAssertions: [
          { file: "main.py", contains: "FastApiMCP" },
          { file: "main.py", contains: "mcp.mount_http()" },
          { file: "main.py", contains: "create_item" },
          { file: "main.py", contains: "CreateItemInput" },
          { file: "requirements.txt", contains: "fastapi-mcp==0.4.0" },
        ],
        toolchain: {
          installCmd: ["uv", "sync"],
          testCmd: ["uv", "run", "pytest"],
          timeoutMs: 300_000,
        },
      });
    },
    300_000,
  );
});
