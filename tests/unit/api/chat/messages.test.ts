import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@/lib/auth/types";

const FIXED_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@localhost",
  name: "Dev User",
  workspaceId: "00000000-0000-0000-0000-000000000002",
};

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const hoisted = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockRl: vi.fn(),
  mockRunClarification: vi.fn(),
  mockRunPlan: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  sessionRow: {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "00000000-0000-0000-0000-000000000001",
    status: "clarifying",
    summary: {} as unknown,
  },
  messageRows: [] as Array<{ role: string; content: string }>,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => hoisted.mockGetCurrentUser(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: {
    check: (key: string, limit: number, windowMs: number) =>
      hoisted.mockRl(key, limit, windowMs),
  },
}));

vi.mock("@/lib/agents/clarification-agent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/clarification-agent")>(
    "@/lib/agents/clarification-agent",
  );
  return {
    ...actual,
    runClarificationTurn: (...args: unknown[]) => hoisted.mockRunClarification(...args),
  };
});

vi.mock("@/lib/agents/plan-agent", () => ({
  runPlanAgent: (...args: unknown[]) => hoisted.mockRunPlan(...args),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => hoisted.mockSelect(),
    insert: () => hoisted.mockInsert(),
    update: () => hoisted.mockUpdate(),
  },
}));

vi.mock("@/db/schema", () => ({
  agentSessions: { id: "id", userId: "uid", status: "status" },
  agentMessages: { id: "id", sessionId: "sid", role: "role", content: "content", createdAt: "ts" },
}));

const { POST } = await import("@/app/api/v1/chat/messages/route");

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readEvents(res: Response): Promise<Array<{ event: string; data: unknown }>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const events: Array<{ event: string; data: unknown }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      let data: unknown = null;
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data = JSON.parse(line.slice(6));
      }
      events.push({ event, data });
    }
  }
  return events;
}

const CLEAN_FACTS = {
  serverName: "orders-mcp",
  purpose: "x",
  boundedContext: "orders",
  dataSources: [],
  externalServices: [],
  proposedTools: [
    {
      name: "get_order",
      description: "Returns an order.",
      safetyClass: "read" as const,
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string" as const,
          required: true,
          description: "The order id.",
        },
      ],
      outputShape: "{}",
      failureModes: ["not_found"],
      requiredScopes: ["orders:read"],
      evals: [],
    },
  ],
};

function wireDbDefaults() {
  // select chain: select().from(t).where(c).limit(1) → [sessionRow]
  // select chain for messages: select().from(t).where(c).orderBy(c) → []
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.limit.mockResolvedValueOnce([hoisted.sessionRow]);
  chain.orderBy.mockResolvedValueOnce(hoisted.messageRows);
  hoisted.mockSelect.mockReturnValue(chain);

  // insert chain: insert().values() → resolves
  const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
  hoisted.mockInsert.mockReturnValue(insertChain);

  // update chain: update().set().where() → resolves
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  hoisted.mockUpdate.mockReturnValue(updateChain);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGetCurrentUser.mockResolvedValue(FIXED_USER);
  hoisted.mockRl.mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
  hoisted.sessionRow.status = "clarifying";
  hoisted.sessionRow.summary = {};
  hoisted.messageRows = [];
  wireDbDefaults();
});

describe("POST /api/v1/chat/messages (SSE)", () => {
  it("happy path — clarifying turn, not ready for plan", async () => {
    hoisted.mockRunClarification.mockResolvedValue({
      extractedFacts: { serverName: "orders-mcp" },
      violations: [],
      advisories: [],
      nextQuestion: "What scopes are needed?",
      completenessScore: 0.5,
      readyForPlan: false,
    });

    const res = await POST(req({ sessionId: SESSION_ID, content: "I want an orders MCP" }));
    const events = await readEvents(res);

    const phases = events.filter((e) => e.event === "phase").map((e) => (e.data as { stage: string }).stage);
    expect(phases).toEqual(["clarifying"]);
    const done = events.find((e) => e.event === "done");
    expect((done!.data as { type: string }).type).toBe("clarification");
    expect(hoisted.mockRunPlan).not.toHaveBeenCalled();
  });

  it("happy path — readyForPlan triggers plan agent + emits planning phase", async () => {
    hoisted.mockRunClarification.mockResolvedValue({
      extractedFacts: CLEAN_FACTS,
      violations: [],
      advisories: [],
      nextQuestion: null,
      completenessScore: 0.95,
      readyForPlan: true,
    });
    hoisted.mockRunPlan.mockResolvedValue({
      serverName: "orders-mcp",
      description: "Orders MCP.",
      tools: CLEAN_FACTS.proposedTools,
      folderStructure: [],
      crosscutting: [],
      verificationChecklist: [],
      violations: [],
    });

    const res = await POST(req({ sessionId: SESSION_ID, content: "good to plan" }));
    const events = await readEvents(res);
    const phases = events.filter((e) => e.event === "phase").map((e) => (e.data as { stage: string }).stage);
    expect(phases).toEqual(["clarifying", "planning"]);
    const done = events.find((e) => e.event === "done");
    expect((done!.data as { type: string }).type).toBe("plan");
  });

  it("returns SSE error event when the agent throws AgentInvalidOutputError", async () => {
    const { AgentInvalidOutputError } = await import("@/lib/agents/clarification-agent");
    hoisted.mockRunClarification.mockRejectedValue(
      new AgentInvalidOutputError("extract", "double parse fail"),
    );

    const res = await POST(req({ sessionId: SESSION_ID, content: "x" }));
    const events = await readEvents(res);
    const err = events.find((e) => e.event === "error");
    expect((err!.data as { code: string }).code).toBe("AGENT_INVALID_OUTPUT");
  });

  it("returns 429 SSE error when rate-limited", async () => {
    hoisted.mockRl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(req({ sessionId: SESSION_ID, content: "x" }));
    expect(res.status).toBe(429);
    const events = await readEvents(res);
    expect(events[0]?.event).toBe("error");
    expect((events[0]?.data as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("returns 400 on invalid request shape", async () => {
    const res = await POST(req({ wrong: "shape" }));
    expect(res.status).toBe(400);
  });

  it("rejects messages on approved sessions", async () => {
    hoisted.sessionRow.status = "approved";
    wireDbDefaults();
    const res = await POST(req({ sessionId: SESSION_ID, content: "x" }));
    expect(res.status).toBe(400);
    const events = await readEvents(res);
    expect((events[0]?.data as { code: string }).code).toBe("VALIDATION_FAILED");
  });

  it("returns 404 when the session is not found or not owned by the user", async () => {
    const emptyChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([]),
      orderBy: vi.fn(),
    };
    hoisted.mockSelect.mockReturnValue(emptyChain);
    const res = await POST(req({ sessionId: SESSION_ID, content: "x" }));
    expect(res.status).toBe(404);
  });
});
