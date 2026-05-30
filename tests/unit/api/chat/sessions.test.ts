import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@/lib/auth/types";

const FIXED_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@localhost",
  name: "Dev User",
  workspaceId: "00000000-0000-0000-0000-000000000002",
};

const { mockGetCurrentUser, mockRl, mockInsert, mockValues, mockReturning } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockRl: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: {
    check: (key: string, limit: number, windowMs: number) => mockRl(key, limit, windowMs),
  },
}));

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  agentSessions: { id: "id-column" },
}));

const { POST } = await import("@/app/api/v1/chat/sessions/route");

function req(): NextRequest {
  return new NextRequest("http://localhost/api/v1/chat/sessions", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(FIXED_USER);
  mockRl.mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
  mockReturning.mockResolvedValue([{ id: "session-id-aaa" }]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
});

describe("POST /api/v1/chat/sessions", () => {
  it("returns ok:true with the new sessionId", async () => {
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.sessionId).toBe("session-id-aaa");
  });

  it("uses chat:<userId> as the rate-limit key", async () => {
    await POST(req());
    expect(mockRl).toHaveBeenCalledWith(`chat:${FIXED_USER.id}`, 60, 60_000);
  });

  it("returns 429 when rate-limited and does not insert", async () => {
    mockRl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 500 INTERNAL_ERROR when the insert throws", async () => {
    mockReturning.mockRejectedValue(new Error("db connection lost"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
