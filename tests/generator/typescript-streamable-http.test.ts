import { describe, it } from "vitest";
import { runGeneratorTest, type GeneratorTestCase } from "./helpers";
import type { WizardConfig } from "@/lib/schemas/wizard";

const fixture: WizardConfig = {
  serverName: "test-mcp-server",
  displayName: "Test MCP Server",
  description: "A test MCP server generated for CI validation",
  version: "0.1.0",
  tool: {
    name: "get_greeting",
    description: "Returns a personalised greeting for the given name",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "The name to greet",
        required: true,
      },
      {
        name: "formal",
        type: "boolean",
        description: "Use formal greeting style",
        required: false,
      },
    ],
  },
  logLevel: "info",
  language: "typescript",
  framework: "sdk",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 3000,
  mcpEndpoint: "/mcp",
};

const testCase: GeneratorTestCase = {
  name: "TypeScript + Streamable HTTP template",
  config: fixture,
  expectedFiles: [
    "package.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "vitest.config.ts",
    ".env.example",
    "README.md",
    "src/index.ts",
    "src/tools/get_greeting.ts",
    "src/tools/get_greeting.test.ts",
    "Dockerfile",
    ".github/workflows/ci.yml",
    "STANDARDS.md",
  ],
  contentAssertions: [
    // SDK version pinned exactly
    { file: "package.json", contains: '"@modelcontextprotocol/sdk": "1.29.0"' },
    // index.ts imports
    { file: "src/index.ts", contains: "@modelcontextprotocol/sdk/server/mcp.js" },
    { file: "src/index.ts", contains: "WebStandardStreamableHTTPServerTransport" },
    { file: "src/index.ts", contains: "sessionIdGenerator: undefined" },
    // Tool file exports
    { file: "src/tools/get_greeting.ts", contains: "export const inputSchema" },
    { file: "src/tools/get_greeting.ts", contains: "export async function handleGetGreeting" },
    { file: "src/tools/get_greeting.ts", contains: "z.string()" },
    { file: "src/tools/get_greeting.ts", contains: "z.boolean().optional()" },
    // Phase 3: traceId + rate limit
    { file: "src/index.ts", contains: "randomUUID" },
    { file: "src/index.ts", contains: "traceId" },
    { file: "src/index.ts", contains: "_rateLimitCounts" },
    { file: "src/index.ts", contains: "RATE_LIMIT_MAX" },
    // Phase 3: error envelope
    { file: "src/tools/get_greeting.ts", contains: "isError: true" },
    { file: "src/tools/get_greeting.ts", contains: "TOOL_ERROR" },
  ],
  toolchain: {
    installCmd: ["pnpm", "install", "--prefer-offline"],
    testCmd: ["pnpm", "test"],
    buildCmd: ["pnpm", "build"],
    bootCheck: {
      startCmd: ["node", "dist/index.js"],
      probeUrl: "http://localhost:3000/healthz",
      expectedStatuses: [200],
      startupMs: 10_000,
      pollIntervalMs: 500,
    },
  },
};

describe("TypeScript + Streamable HTTP template", () => {
  it("renders, installs, tests, and builds successfully", async () => {
    await runGeneratorTest(testCase);
  });
});
