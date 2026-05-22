import { describe, it, expect } from "vitest";
import { lintToolDescription, lintWizardConfig } from "@/lib/linter";
import type { WizardConfig } from "@/lib/schemas/wizard";

const CLEAN_CONFIG: WizardConfig = {
  serverName: "test-server",
  displayName: "Test Server",
  description: "A test server",
  version: "0.1.0",
  tool: {
    name: "get_greeting",
    description: "Returns a personalized greeting for the given name",
    parameters: [
      { name: "name", type: "string", description: "The person name to greet", required: true },
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

describe("lintToolDescription", () => {
  it("returns ok:true for a well-formed description", () => {
    const r = lintToolDescription("Returns a personalized greeting for the given name");
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("flags AWS access key in description", () => {
    const r = lintToolDescription("Authenticate using AKIAIOSFODNN7EXAMPLE from your config");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags JWT token in description", () => {
    const r = lintToolDescription(
      "Send eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in the header",
    );
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags OpenAI sk- key in description", () => {
    const r = lintToolDescription("Uses sk-proj-abc123def456ghi789jkl012mno345pqrstu for auth");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("flags GitHub PAT in description", () => {
    // Real GitHub PAT format: ghp_ + exactly 36 alphanumeric chars (26 + 10 = 36)
    const r = lintToolDescription(
      "Token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 grants write access",
    );
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "PROBABLE_SECRET")).toBeDefined();
  });

  it("returns error for descriptions shorter than 20 chars", () => {
    const r = lintToolDescription("short");
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === "DESCRIPTION_TOO_SHORT")).toBeDefined();
  });

  it("returns a warning (not error) when description has no action verb", () => {
    const r = lintToolDescription("A tool that produces a greeting for the specified name");
    expect(r.ok).toBe(true); // warnings don't block generation
    expect(r.issues.find((i) => i.code === "NOT_ACTION_ORIENTED")?.severity).toBe("warn");
  });
});

describe("lintWizardConfig", () => {
  it("passes a clean config", () => {
    expect(lintWizardConfig(CLEAN_CONFIG).ok).toBe(true);
  });

  it("fails when tool description contains a secret", () => {
    const r = lintWizardConfig({
      ...CLEAN_CONFIG,
      tool: {
        ...CLEAN_CONFIG.tool,
        description: "Uses sk-live-abc123def456ghi789jkl012mno345pqrstu for Stripe",
      },
    });
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.path).toBe("tool.description");
  });

  it("fails when a parameter description contains a secret", () => {
    const r = lintWizardConfig({
      ...CLEAN_CONFIG,
      tool: {
        ...CLEAN_CONFIG.tool,
        parameters: [
          {
            name: "key",
            type: "string",
            description: "Pass AKIAIOSFODNN7EXAMPLE as the API key",
            required: true,
          },
        ],
      },
    });
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.path).toBe("tool.parameters.key.description");
  });

  it("does NOT flag a short parameter description (length check is tool-description only)", () => {
    // "Search query" = 12 chars — fine for a type hint, not fine for a tool description
    const r = lintWizardConfig({
      ...CLEAN_CONFIG,
      tool: {
        ...CLEAN_CONFIG.tool,
        parameters: [
          { name: "q", type: "string", description: "Search query", required: true },
        ],
      },
    });
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.path?.startsWith("tool.parameters"))).toHaveLength(0);
  });
});
