import { describe, it, expect } from "vitest";
import {
  descriptionMinLengthValidator,
  fieldDescriptionRequiredValidator,
} from "@/lib/agents/validators/schema-validators";

describe("descriptionMinLengthValidator", () => {
  it("accepts descriptions at or above 20 chars", () => {
    expect(
      descriptionMinLengthValidator("Returns the deployment status for a service", "p"),
    ).toEqual({ ok: true });
  });

  it("rejects empty / undefined", () => {
    expect(descriptionMinLengthValidator(undefined, "p").ok).toBe(false);
    expect(descriptionMinLengthValidator("", "p").ok).toBe(false);
  });

  it("rejects descriptions shorter than 20 chars", () => {
    const r = descriptionMinLengthValidator("Too short", "p");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.code).toBe("DESCRIPTION_TOO_SHORT");
      expect(r.violation.section).toBe("§7.3");
    }
  });
});

describe("fieldDescriptionRequiredValidator", () => {
  it("accepts a non-empty description", () => {
    expect(
      fieldDescriptionRequiredValidator({ name: "x", description: "the thing" }, "p"),
    ).toEqual({ ok: true });
  });

  it("rejects missing description", () => {
    const r = fieldDescriptionRequiredValidator({ name: "x" }, "p");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.code).toBe("FIELD_DESCRIPTION_MISSING");
      expect(r.violation.section).toBe("§8.3");
    }
  });

  it("rejects whitespace-only description", () => {
    const r = fieldDescriptionRequiredValidator({ name: "x", description: "   " }, "p");
    expect(r.ok).toBe(false);
  });
});
