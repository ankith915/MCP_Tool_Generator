import { describe, it, expect } from "vitest";
import { pythonIdentifierValidator } from "@/lib/agents/validators/identifier-validators";

describe("pythonIdentifierValidator", () => {
  it("accepts a valid identifier", () => {
    expect(pythonIdentifierValidator("service_id", "p")).toEqual({ ok: true });
  });

  it("accepts a leading underscore", () => {
    expect(pythonIdentifierValidator("_private", "p")).toEqual({ ok: true });
  });

  it("rejects names starting with a digit", () => {
    const r = pythonIdentifierValidator("2nd_arg", "p");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.code).toBe("INVALID_PYTHON_IDENTIFIER");
  });

  it("rejects names containing hyphens", () => {
    const r = pythonIdentifierValidator("service-id", "p");
    expect(r.ok).toBe(false);
  });

  it("rejects Python keywords (class, def, return, etc.)", () => {
    for (const kw of ["class", "def", "return", "import", "from", "lambda", "yield"]) {
      const r = pythonIdentifierValidator(kw, "p");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.violation.code).toBe("PYTHON_KEYWORD_COLLISION");
    }
  });

  it("rejects soft keywords match / case", () => {
    expect(pythonIdentifierValidator("match", "p").ok).toBe(false);
    expect(pythonIdentifierValidator("case", "p").ok).toBe(false);
  });
});
