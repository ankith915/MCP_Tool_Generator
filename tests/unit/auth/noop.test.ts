import { describe, it, expect } from "vitest";
import { NoopAuthAdapter } from "@/lib/auth/adapters/noop";

describe("NoopAuthAdapter", () => {
  it("returns the fixed dev user", async () => {
    const adapter = new NoopAuthAdapter();
    const user = await adapter.getCurrentUser();
    expect(user.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(user.email).toBe("dev@localhost");
    expect(user.workspaceId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("returns the same user on every call (no state)", async () => {
    const adapter = new NoopAuthAdapter();
    const a = await adapter.getCurrentUser();
    const b = await adapter.getCurrentUser();
    expect(a.id).toBe(b.id);
  });
});
