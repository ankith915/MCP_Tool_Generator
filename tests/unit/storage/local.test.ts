import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { LocalAdapter } from "@/lib/storage/adapters/local";

const tmpDir = path.join(os.tmpdir(), `mcp-storage-test-${Date.now()}`);
const adapter = new LocalAdapter(tmpDir);

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("LocalAdapter", () => {
  it("round-trips a buffer", async () => {
    await adapter.put("test/file.bin", Buffer.from("hello"));
    const result = await adapter.get("test/file.bin");
    expect(result?.toString()).toBe("hello");
  });

  it("returns null for a missing key", async () => {
    expect(await adapter.get("does-not-exist.bin")).toBeNull();
  });

  it("deletes a file", async () => {
    await adapter.put("del.bin", Buffer.from("x"));
    await adapter.delete("del.bin");
    expect(await adapter.get("del.bin")).toBeNull();
  });

  it("url returns an /api/artifacts/ path", () => {
    expect(adapter.url("foo/bar.zip")).toBe("/api/artifacts/foo/bar.zip");
  });
});
