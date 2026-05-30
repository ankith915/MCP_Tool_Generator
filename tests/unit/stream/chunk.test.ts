import { describe, it, expect } from "vitest";
import { chunkContent, sortPaths } from "@/lib/stream/chunk";

describe("chunkContent", () => {
  it("returns an empty array for empty content", () => {
    expect(chunkContent("", 4)).toEqual([]);
  });

  it("returns a single chunk when content fits in one group", () => {
    expect(chunkContent("a\nb\nc", 5)).toEqual(["a\nb\nc"]);
  });

  it("splits content into line-grouped chunks", () => {
    const content = "one\ntwo\nthree\nfour\nfive";
    const out = chunkContent(content, 2);
    expect(out).toEqual(["one\ntwo\n", "three\nfour\n", "five"]);
  });

  it("reconstructs the original content losslessly when chunks are joined", () => {
    const content =
      "from __future__ import annotations\n\nimport structlog\n\n" +
      "log = structlog.get_logger()\n";
    const reconstructed = chunkContent(content, 2).join("");
    expect(reconstructed).toBe(content);
  });

  it("throws when linesPerChunk is not positive", () => {
    expect(() => chunkContent("a", 0)).toThrow(/positive/);
    expect(() => chunkContent("a", -1)).toThrow(/positive/);
  });
});

describe("sortPaths", () => {
  it("puts root metadata first, then app/, then tests/", () => {
    const out = sortPaths([
      "tests/integration/test_health.py",
      "app/main.py",
      "pyproject.toml",
      "README.md",
      "tests/conftest.py",
    ]);
    expect(out).toEqual([
      "pyproject.toml",
      "README.md",
      "app/main.py",
      "tests/conftest.py",
      "tests/integration/test_health.py",
    ]);
  });

  it("orders shallower files before deeper ones within a group", () => {
    const out = sortPaths([
      "app/api/routers/health.py",
      "app/main.py",
      "app/mcp/server.py",
    ]);
    expect(out[0]).toBe("app/main.py");
    // After main, the depth-3 files come next, alphabetically.
    expect(out.slice(1)).toEqual([
      "app/mcp/server.py",
      "app/api/routers/health.py",
    ]);
  });

  it("breaks depth ties alphabetically", () => {
    const out = sortPaths([
      "app/mcp/tools.py",
      "app/mcp/schemas.py",
      "app/mcp/server.py",
    ]);
    expect(out).toEqual([
      "app/mcp/schemas.py",
      "app/mcp/server.py",
      "app/mcp/tools.py",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = ["b.py", "a.py"];
    const out = sortPaths(input);
    expect(input).toEqual(["b.py", "a.py"]);
    expect(out).toEqual(["a.py", "b.py"]);
  });
});
