import { describe, it, expect } from "vitest";
import { runGeneratorTest, type GeneratorTestCase } from "./helpers";
import { renderProject } from "@/server/services/generate";
import type { WizardConfig } from "@/lib/schemas/wizard";

const fixture: WizardConfig = {
  serverName: "test-stdio-server",
  displayName: "Test Stdio Server",
  description: "A test MCP server using stdio transport",
  version: "0.1.0",
  tool: {
    name: "say_hello",
    description: "Says hello to a named person with a friendly greeting",
    parameters: [
      { name: "name", type: "string", description: "The person's name", required: true },
    ],
  },
  logLevel: "info",
  language: "typescript",
  framework: "sdk",
  transport: "stdio",
  existingFastapiService: false,
  port: 3000,        // ignored by stdio, but required by schema
  mcpEndpoint: "/mcp", // ignored by stdio, but required by schema
};

const testCase: GeneratorTestCase = {
  name: "TypeScript + stdio template",
  config: fixture,
  expectedFiles: [
    "package.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "vitest.config.ts",
    ".env.example",
    "README.md",
    "src/index.ts",
    "src/tools/say_hello.ts",
    "src/tools/say_hello.test.ts",
  ],
  contentAssertions: [
    // SDK version pinned exactly
    { file: "package.json", contains: '"@modelcontextprotocol/sdk": "1.29.0"' },
    // stdio-specific transport
    { file: "src/index.ts", contains: "StdioServerTransport" },
    { file: "src/index.ts", contains: "server.connect(transport)" },
  ],
  toolchain: {
    installCmd: ["pnpm", "install", "--prefer-offline"],
    testCmd: ["pnpm", "test"],
    buildCmd: ["pnpm", "build"],
    // No bootCheck — stdio has no HTTP endpoint to probe
  },
};

describe("TypeScript + stdio template", () => {
  it("renders, installs, tests, and builds successfully", async () => {
    // Extra negative assertions that can't go through contentAssertions
    const files = await renderProject(fixture);
    const indexContent = files["src/index.ts"] ?? "";
    const pkgContent = files["package.json"] ?? "";

    expect(indexContent, "src/index.ts must not import hono").not.toContain("hono");
    expect(pkgContent, "package.json must not depend on hono").not.toContain("hono");

    await runGeneratorTest(testCase);
  });
});
