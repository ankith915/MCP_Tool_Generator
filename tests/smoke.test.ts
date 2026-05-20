import { describe, it, expect } from "vitest";

describe("environment smoke", () => {
  it("env vars parse without throwing", async () => {
    const { env } = await import("@/lib/env");
    expect(env.AUTH_PROVIDER).toBe("noop");
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.RATE_LIMIT_PROVIDER).toBe("memory");
  });
});
