import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderProject } from "@/server/services/generate";
import type { WizardConfig } from "@/lib/schemas/wizard";

const FIXTURE_CONFIG: WizardConfig = {
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

describe("TypeScript + Streamable HTTP template", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("renders all expected files", async () => {
    const files = await renderProject(FIXTURE_CONFIG);

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "package.json",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "vitest.config.ts",
        ".env.example",
        "README.md",
        "src/index.ts",
        "src/tools/get_greeting.ts",
        "src/tools/get_greeting.test.ts",
      ]),
    );
  });

  it("generated package.json pins the SDK version exactly", async () => {
    const files = await renderProject(FIXTURE_CONFIG);
    const pkg = JSON.parse(files["package.json"] ?? "{}") as Record<string, unknown>;
    const deps = pkg["dependencies"] as Record<string, string>;
    expect(deps["@modelcontextprotocol/sdk"]).toBe("1.29.0");
  });

  it("generated src/index.ts imports from the SDK", async () => {
    const files = await renderProject(FIXTURE_CONFIG);
    const indexTs = files["src/index.ts"] ?? "";
    expect(indexTs).toContain("@modelcontextprotocol/sdk/server/mcp.js");
    expect(indexTs).toContain("WebStandardStreamableHTTPServerTransport");
    expect(indexTs).toContain("sessionIdGenerator: undefined");
  });

  it("generated tool file exports inputSchema and handler", async () => {
    const files = await renderProject(FIXTURE_CONFIG);
    const toolTs = files["src/tools/get_greeting.ts"] ?? "";
    expect(toolTs).toContain("export const inputSchema");
    expect(toolTs).toContain("export async function handleGetGreeting");
    expect(toolTs).toContain('z.string()');
    expect(toolTs).toContain('z.boolean().optional()');
  });

  it("generated project installs, tests, and builds successfully", async () => {
    const files = await renderProject(FIXTURE_CONFIG);

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "mcp-gen-test-"));
    tmpDirs.push(tmpDir);

    for (const [filename, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filename);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    }

    const run = (cmd: string) =>
      execSync(cmd, {
        cwd: tmpDir,
        stdio: "pipe",
        timeout: 240_000,
        env: { ...process.env, NODE_ENV: "test" },
      });

    run("pnpm install --prefer-offline");
    run("pnpm test");
    run("pnpm build");

    expect(true).toBe(true);
  });
});
