import { describe, it, expect, beforeEach } from "vitest";
import {
  getPlaybookSnippets,
  listSectionKeys,
  resetPlaybookCache,
} from "@/lib/agents/playbook-context";

describe("playbook-context", () => {
  beforeEach(() => {
    resetPlaybookCache();
  });

  it("lists most of the 21 top-level sections", () => {
    const keys = listSectionKeys();
    expect(keys).toContain("§1");
    expect(keys).toContain("§6");
    expect(keys).toContain("§17");
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  it("returns a section's full text", () => {
    const text = getPlaybookSnippets(["§6"]);
    expect(text).toContain("Tool Design Principles");
    expect(text.toLowerCase()).toContain("safety class");
  });

  it("returns multiple sections joined by separator", () => {
    const text = getPlaybookSnippets(["§4", "§6"]);
    expect(text).toContain("Choosing a Library");
    expect(text).toContain("Tool Design Principles");
    expect(text).toContain("---");
  });

  it("treats sub-section keys (§6.2) as their parent (§6)", () => {
    const sub = getPlaybookSnippets(["§6.2"]);
    const parent = getPlaybookSnippets(["§6"]);
    expect(sub).toBe(parent);
  });

  it("deduplicates when the same parent section is referenced twice", () => {
    const once = getPlaybookSnippets(["§6"]);
    const dup = getPlaybookSnippets(["§6", "§6.2"]);
    expect(dup).toBe(once);
  });

  it("keeps a typical agent snippet bundle under a sane character budget", () => {
    const all = getPlaybookSnippets(["§4", "§6", "§7", "§8", "§11"]);
    // ~4 chars/token → 64000 chars ≈ 16k tokens, well below the 70B context window.
    expect(all.length).toBeLessThan(64000);
  });
});
