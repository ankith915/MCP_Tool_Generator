import { describe, it, expect } from "vitest";
import {
  maxToolsValidator,
  uniqueToolNamesValidator,
} from "@/lib/agents/validators/count-validators";

function tools(n: number): { name: string }[] {
  return Array.from({ length: n }, (_, i) => ({ name: `tool_${i}` }));
}

describe("maxToolsValidator", () => {
  it("allows 30 tools (boundary)", () => {
    expect(maxToolsValidator(tools(30))).toEqual({ ok: true });
  });

  it("rejects 31 tools", () => {
    const r = maxToolsValidator(tools(31));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.code).toBe("TOO_MANY_TOOLS");
      expect(r.violation.section).toBe("§6.5");
    }
  });

  it("allows zero tools (other validators handle emptiness)", () => {
    expect(maxToolsValidator([])).toEqual({ ok: true });
  });
});

describe("uniqueToolNamesValidator", () => {
  it("returns empty when all names are unique", () => {
    expect(uniqueToolNamesValidator(tools(5))).toEqual([]);
  });

  it("flags one duplicate, pointing at the second occurrence", () => {
    const result = uniqueToolNamesValidator([
      { name: "get_thing" },
      { name: "list_things" },
      { name: "get_thing" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe("TOOL_NAME_DUPLICATE");
    expect(result[0]!.path).toBe("tools[2].name");
  });

  it("flags every duplicate occurrence beyond the first", () => {
    const result = uniqueToolNamesValidator([
      { name: "x" },
      { name: "x" },
      { name: "x" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.path).toBe("tools[1].name");
    expect(result[1]!.path).toBe("tools[2].name");
  });
});
