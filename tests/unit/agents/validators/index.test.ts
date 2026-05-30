import { describe, it, expect } from "vitest";
import {
  validateExtractedFacts,
  validatePlan,
  formatViolationsForPrompt,
} from "@/lib/agents/validators";
import type {
  ValidatableFacts,
  ValidatablePlan,
} from "@/lib/agents/validators/types";

const CLEAN_TOOL = {
  name: "get_deployment_status",
  description: "Returns the current deployment status for a service in an environment.",
  safetyClass: "read" as const,
  inputs: [
    { name: "service_id", description: "The service identifier.", required: true },
    { name: "environment", description: "One of production, staging, dev.", required: true },
  ],
};

const CLEAN_FACTS: ValidatableFacts = {
  serverName: "deployments-mcp",
  proposedTools: [CLEAN_TOOL],
};

const CLEAN_PLAN: ValidatablePlan = {
  serverName: "deployments-mcp",
  tools: [CLEAN_TOOL],
};

describe("validateExtractedFacts", () => {
  it("returns empty for clean facts", () => {
    expect(validateExtractedFacts(CLEAN_FACTS)).toEqual([]);
  });

  it("flags an invalid server name", () => {
    const v = validateExtractedFacts({ ...CLEAN_FACTS, serverName: "deployments" });
    expect(v.some((x) => x.code === "SERVER_NAME_INVALID")).toBe(true);
  });

  it("skips server name when undefined (clarification still in progress)", () => {
    const v = validateExtractedFacts({ proposedTools: [CLEAN_TOOL] });
    expect(v.some((x) => x.code === "SERVER_NAME_INVALID")).toBe(false);
  });

  it("flags banned tool prefix in proposedTools", () => {
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: [{ ...CLEAN_TOOL, name: "manage_deployment" }],
    });
    expect(v.some((x) => x.code === "TOOL_NAME_BANNED_PREFIX")).toBe(true);
    expect(v[0]!.path).toBe("proposedTools[0].name");
  });

  it("flags parameter naming and python identifier issues together", () => {
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: [
        {
          ...CLEAN_TOOL,
          inputs: [{ name: "class", description: "An identifier." }],
        },
      ],
    });
    // 'class' is snake_case-valid so parameter validator passes, but is a Python keyword.
    expect(v.some((x) => x.code === "PYTHON_KEYWORD_COLLISION")).toBe(true);
  });

  it("flags duplicate tool names", () => {
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: [CLEAN_TOOL, CLEAN_TOOL],
    });
    expect(v.some((x) => x.code === "TOOL_NAME_DUPLICATE")).toBe(true);
  });

  it("flags >30 tools", () => {
    const many = Array.from({ length: 31 }, (_, i) => ({
      ...CLEAN_TOOL,
      name: `get_thing_${i}`,
    }));
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: many,
    });
    expect(v.some((x) => x.code === "TOO_MANY_TOOLS")).toBe(true);
  });

  it("flags too-short description on a tool", () => {
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: [{ ...CLEAN_TOOL, description: "short" }],
    });
    expect(v.some((x) => x.code === "DESCRIPTION_TOO_SHORT")).toBe(true);
  });

  it("flags a missing parameter description", () => {
    const v = validateExtractedFacts({
      ...CLEAN_FACTS,
      proposedTools: [
        {
          ...CLEAN_TOOL,
          inputs: [{ name: "service_id" }],
        },
      ],
    });
    expect(v.some((x) => x.code === "FIELD_DESCRIPTION_MISSING")).toBe(true);
  });
});

describe("validatePlan", () => {
  it("returns empty for a clean plan", () => {
    expect(validatePlan(CLEAN_PLAN)).toEqual([]);
  });

  it("always requires serverName (unlike extracted facts)", () => {
    const v = validatePlan({ ...CLEAN_PLAN, serverName: "invalid" });
    expect(v.some((x) => x.code === "SERVER_NAME_INVALID")).toBe(true);
  });

  it("uses tools[] path prefix (not proposedTools[])", () => {
    const v = validatePlan({
      ...CLEAN_PLAN,
      tools: [{ ...CLEAN_TOOL, name: "manage_x" }],
    });
    expect(v[0]!.path).toBe("tools[0].name");
  });
});

describe("formatViolationsForPrompt", () => {
  it("returns a friendly message on empty violations", () => {
    expect(formatViolationsForPrompt([])).toBe(
      "No deterministic violations detected.",
    );
  });

  it("formats each violation as one line with code, path, section, message", () => {
    const v = validatePlan({
      ...CLEAN_PLAN,
      tools: [{ ...CLEAN_TOOL, name: "manage_x" }],
    });
    const formatted = formatViolationsForPrompt(v);
    expect(formatted).toMatch(/TOOL_NAME_BANNED_PREFIX/);
    expect(formatted).toMatch(/tools\[0\]\.name/);
    expect(formatted).toMatch(/§A3/);
  });
});
