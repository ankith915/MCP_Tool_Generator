import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@/lib/auth/types";
import type { RateLimitResult } from "@/lib/rate-limit/types";
import type { WizardConfig } from "@/lib/schemas/wizard";

// ── Mocks (declared before any imports that trigger module evaluation) ─────────

const FIXED_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@example.com",
  name: "Dev User",
  workspaceId: "00000000-0000-0000-0000-000000000002",
};

const mockGetCurrentUser = vi.fn<() => Promise<User>>();
const mockRateLimitCheck = vi.fn<(key: string, limit: number, windowMs: number) => Promise<RateLimitResult>>();
const mockGenerate = vi.fn<(config: WizardConfig, userId: string, workspaceId: string) => Promise<{ artifactUrl: string; files: Record<string, string> }>>();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: {
    check: (key: string, limit: number, windowMs: number) =>
      mockRateLimitCheck(key, limit, windowMs),
  },
}));

vi.mock("@/server/services/generate", () => ({
  generate: (config: WizardConfig, userId: string, workspaceId: string) =>
    mockGenerate(config, userId, workspaceId),
  renderProject: vi.fn(),
}));

// Import after mocks are registered
const { POST } = await import("@/app/api/v1/generate/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_CONFIG: WizardConfig = {
  serverName: "my-mcp-server",
  displayName: "My MCP Server",
  description: "A test MCP server",
  version: "0.1.0",
  tool: {
    name: "get_data",
    description: "Fetches data from an external source",
    parameters: [
      { name: "query", type: "string", description: "Search query", required: true },
    ],
  },
  logLevel: "info",
  language: "typescript",
  framework: "sdk",
  transport: "streamable-http",
  existingFastapiService: false,
  port: 3000,
  mcpEndpoint: "/mcp",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ALLOWED_RL: RateLimitResult = { allowed: true, remaining: 29, resetAt: Date.now() + 3600_000 };
const BLOCKED_RL: RateLimitResult = { allowed: false, remaining: 0, resetAt: Date.now() + 3600_000 };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/v1/generate", () => {
  beforeEach(() => {
    mockGetCurrentUser.mockResolvedValue(FIXED_USER);
    mockRateLimitCheck.mockResolvedValue(ALLOWED_RL);
    mockGenerate.mockResolvedValue({
      artifactUrl: "/artifacts/dev/abc123.zip",
      files: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true with artifact URL on a valid request", async () => {
    const res = await POST(makeRequest(VALID_CONFIG));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.url).toBe("/artifacts/dev/abc123.zip");
  });

  it("passes the correct user id and workspace id to generate()", async () => {
    await POST(makeRequest(VALID_CONFIG));

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ serverName: "my-mcp-server" }),
      FIXED_USER.id,
      FIXED_USER.workspaceId,
    );
  });

  it("uses the correct rate-limit key (generate:<userId>)", async () => {
    await POST(makeRequest(VALID_CONFIG));

    expect(mockRateLimitCheck).toHaveBeenCalledWith(
      `generate:${FIXED_USER.id}`,
      30,
      3_600_000,
    );
  });

  it("returns 400 VALIDATION_FAILED when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 400 VALIDATION_FAILED when config fails Zod validation", async () => {
    const res = await POST(makeRequest({ serverName: "bad name!" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toBeDefined();
  });

  it("returns 429 RATE_LIMITED when the rate limit is exhausted", async () => {
    mockRateLimitCheck.mockResolvedValue(BLOCKED_RL);

    const res = await POST(makeRequest(VALID_CONFIG));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    // generate() must NOT be called when rate-limited
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns 500 INTERNAL_ERROR when generate() throws", async () => {
    mockGenerate.mockRejectedValue(new Error("db connection lost"));

    const res = await POST(makeRequest(VALID_CONFIG));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("auth always goes through getCurrentUser() — rate-limit key uses returned id", async () => {
    const otherUser: User = { ...FIXED_USER, id: "aaaaaaaa-0000-0000-0000-000000000099" };
    mockGetCurrentUser.mockResolvedValue(otherUser);

    await POST(makeRequest(VALID_CONFIG));

    expect(mockRateLimitCheck.mock.calls[0]?.[0]).toBe(`generate:${otherUser.id}`);
  });
});
