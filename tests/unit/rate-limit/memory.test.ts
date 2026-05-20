import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "@/lib/rate-limit/adapters/memory";

let adapter: InMemoryAdapter;

beforeEach(() => {
  adapter = new InMemoryAdapter();
});

describe("InMemoryAdapter", () => {
  it("allows the first request", async () => {
    const result = await adapter.check("user:1", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await adapter.check("user:1", 5, 60_000);
    }
    const result = await adapter.check("user:1", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isolates different keys", async () => {
    for (let i = 0; i < 5; i++) {
      await adapter.check("user:1", 5, 60_000);
    }
    const result = await adapter.check("user:2", 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    await adapter.check("user:1", 1, 1);
    await new Promise((r) => setTimeout(r, 10));
    const result = await adapter.check("user:1", 1, 1);
    expect(result.allowed).toBe(true);
  });
});
