import { describe, it, expect, beforeEach, vi } from "vitest";

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock("@/lib/agents/llm", () => ({
  chat: chatMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "sk-test",
    OPENAI_MAX_TOKENS: 4096,
    OPENAI_CLARIFY_MODEL: "gpt-4.1-mini",
    OPENAI_PLAN_MODEL: "o4-mini",
    OPENAI_CODEGEN_MODEL: "gpt-4.1-mini",
    CHAT_FLOW_ENABLED: true,
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { runPlanAgent, refinePlan } from "@/lib/agents/plan-agent";
import { AgentInvalidOutputError } from "@/lib/agents/clarification-agent";
import type { ExtractedFacts, PlanProposal } from "@/lib/schemas/agents";

const FACTS: ExtractedFacts = {
  serverName: "orders-mcp",
  purpose: "Read-only access to orders and shipments for internal agents.",
  boundedContext: "orders",
  dataSources: [{ name: "orders_db", classification: "internal" }],
  externalServices: [],
  proposedTools: [
    {
      name: "get_order",
      description: "Returns a single order by id.",
      safetyClass: "read",
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string",
          required: true,
          description: "Unique order id.",
        },
      ],
      outputShape: "{ id, status, line_items[] }",
      failureModes: ["not_found", "validation"],
      requiredScopes: ["orders:read"],
      evals: [],
    },
    {
      name: "list_shipments",
      description: "Lists shipments for an order.",
      safetyClass: "read",
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string",
          required: true,
          description: "The order id.",
        },
      ],
      outputShape: "{ items: [], next_cursor: string|null }",
      failureModes: ["not_found"],
      requiredScopes: ["orders:read"],
      evals: [],
    },
  ],
};

const CLEAN_PLAN_DRAFT = {
  serverName: "orders-mcp",
  description: "Internal orders MCP server.",
  tools: [
    {
      name: "get_order",
      description: "Returns a single order by id.",
      safetyClass: "read" as const,
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string" as const,
          required: true,
          description: "Unique order id.",
        },
      ],
      outputShape: "{ id, status, line_items[] }",
      failureModes: ["not_found", "validation"],
      requiredScopes: ["orders:read"],
      doc: {
        purpose: "Return the order with the given id.",
        parameters: "order_id is the canonical id used across the orders system.",
        returns: "OrderRecord with status and line items.",
        failureModes: "not_found when the id is unknown.",
      },
    },
    {
      name: "list_shipments",
      description: "Lists shipments for an order.",
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
      outputShape: "{ items: [], next_cursor: string|null }",
      failureModes: ["not_found"],
      requiredScopes: ["orders:read"],
      doc: {
        purpose: "Return the shipment history for an order.",
        parameters: "order_id matches get_order.",
        returns: "Paged list of ShipmentRecord with next_cursor.",
        failureModes: "not_found when the order does not exist.",
      },
    },
  ],
  folderStructure: ["app/main.py", "app/mcp/server.py"],
  crosscutting: ["structlog", "otel", "pydantic-settings", "health-endpoints"],
  verificationChecklist: ["All tools have a verb_noun name (§7.2)"],
};

const EVALS = {
  evals: {
    get_order: [
      {
        prompt: "What's the status of order 12345?",
        expectedTool: "get_order",
        expectedArguments: { order_id: "12345" },
      },
      {
        prompt: "Fetch order ABC-987",
        expectedTool: "get_order",
        expectedArguments: { order_id: "ABC-987" },
      },
    ],
    list_shipments: [
      {
        prompt: "Show shipments for order 12345",
        expectedTool: "list_shipments",
        expectedArguments: { order_id: "12345" },
      },
    ],
  },
};

function chatResponse(payload: unknown): { content: string; finishReason: string } {
  return { content: JSON.stringify(payload), finishReason: "stop" };
}

beforeEach(() => {
  chatMock.mockReset();
});

describe("runPlanAgent", () => {
  it("happy path: synthesis + eval generation + clean post-validation", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(EVALS));

    const plan = await runPlanAgent(FACTS);
    expect(plan.serverName).toBe("orders-mcp");
    expect(plan.tools).toHaveLength(2);
    expect(plan.violations).toEqual([]);
    expect(plan.tools[0]!.evals).toHaveLength(2);
    expect(plan.tools[1]!.evals).toHaveLength(1);
  });

  it("merges evals by tool name and drops cross-mapped entries", async () => {
    const mismatched = {
      evals: {
        get_order: [
          {
            prompt: "Show shipments for order 12345",
            expectedTool: "list_shipments", // ← wrong key/value mapping
            expectedArguments: {},
          },
        ],
        list_shipments: EVALS.evals.list_shipments,
      },
    };
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(mismatched));

    const plan = await runPlanAgent(FACTS);
    expect(plan.tools[0]!.evals).toHaveLength(0);
    expect(plan.tools[1]!.evals).toHaveLength(1);
  });

  it("eval-generation failure is non-blocking — tools just have no evals", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockRejectedValueOnce(new Error("groq 500"));

    const plan = await runPlanAgent(FACTS);
    expect(plan.tools.every((t) => t.evals.length === 0)).toBe(true);
    expect(plan.violations).toEqual([]);
  });

  it("eval-generation invalid JSON is non-blocking", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce({ content: "garbage", finishReason: "stop" });

    const plan = await runPlanAgent(FACTS);
    expect(plan.tools.every((t) => t.evals.length === 0)).toBe(true);
  });

  it("retries synthesis once on bad JSON then succeeds", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(EVALS));

    const plan = await runPlanAgent(FACTS);
    expect(plan.serverName).toBe("orders-mcp");
    expect(chatMock).toHaveBeenCalledTimes(3);
  });

  it("throws AgentInvalidOutputError when synthesis fails twice", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce({ content: "still not json", finishReason: "stop" });

    await expect(runPlanAgent(FACTS)).rejects.toBeInstanceOf(AgentInvalidOutputError);
  });

  it("surfaces post-validation violations from the synthesized plan", async () => {
    const badDraft = {
      ...CLEAN_PLAN_DRAFT,
      tools: [
        {
          ...CLEAN_PLAN_DRAFT.tools[0]!,
          name: "manage_orders",
        },
        CLEAN_PLAN_DRAFT.tools[1]!,
      ],
    };
    chatMock
      .mockResolvedValueOnce(chatResponse(badDraft))
      .mockResolvedValueOnce(chatResponse(EVALS));

    const plan = await runPlanAgent(FACTS);
    expect(plan.violations.some((v) => v.code === "TOOL_NAME_BANNED_PREFIX")).toBe(true);
  });

  it("synthesis prompt includes pre-violations from the input facts", async () => {
    const badFacts: ExtractedFacts = {
      ...FACTS,
      serverName: "broken",
    };
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(EVALS));

    await runPlanAgent(badFacts);
    const firstCallMessages = chatMock.mock.calls[0]![0]!.messages;
    const systemContent = firstCallMessages[0]!.content;
    expect(systemContent).toContain("SERVER_NAME_INVALID");
  });

  it("forwards onReasoning callback to the synthesis chat call", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(EVALS));
    const onReasoning = vi.fn();
    await runPlanAgent(FACTS, [], { onReasoning });
    // The first call is plan synthesis (o4-mini); it should carry the callback.
    const synthRequest = chatMock.mock.calls[0]![0] as { onReasoning?: unknown };
    expect(synthRequest.onReasoning).toBe(onReasoning);
  });

  it("doc fields flow through to the plan", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT))
      .mockResolvedValueOnce(chatResponse(EVALS));

    const plan = await runPlanAgent(FACTS);
    expect(plan.tools[0]!.doc?.purpose).toBe("Return the order with the given id.");
    expect(plan.tools[1]!.doc?.returns).toContain("ShipmentRecord");
  });
});

const PRIOR_PLAN: PlanProposal = {
  serverName: "orders-mcp",
  description: "Internal orders MCP server.",
  tools: [
    { ...CLEAN_PLAN_DRAFT.tools[0]!, evals: [] },
    { ...CLEAN_PLAN_DRAFT.tools[1]!, evals: [] },
  ],
  folderStructure: ["app/main.py", "app/mcp/server.py"],
  crosscutting: ["structlog", "otel", "pydantic-settings", "health-endpoints"],
  verificationChecklist: ["All tools have a verb_noun name (§7.2)"],
  violations: [],
};

describe("refinePlan", () => {
  it("calls the model once with the refinement messages and returns a validated plan", async () => {
    const refinedDraft = {
      ...CLEAN_PLAN_DRAFT,
      tools: [
        ...CLEAN_PLAN_DRAFT.tools,
        {
          name: "delete_order",
          description: "Hard-deletes an order by id.",
          safetyClass: "destructive" as const,
          idempotent: true,
          inputs: [
            {
              name: "order_id",
              type: "string" as const,
              required: true,
              description: "Unique order id to delete.",
            },
          ],
          outputShape: "{ deleted: true }",
          failureModes: ["not_found"],
          requiredScopes: ["orders:write"],
          doc: {
            purpose: "Permanently delete an order by id.",
            parameters: "order_id is the canonical id.",
            returns: "Confirmation of deletion.",
            failureModes: "not_found when id is unknown.",
          },
        },
      ],
    };
    chatMock.mockResolvedValueOnce(chatResponse(refinedDraft));

    const refined = await refinePlan(PRIOR_PLAN, "add a delete_order tool");

    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(refined.tools).toHaveLength(3);
    expect(refined.tools[2]!.name).toBe("delete_order");
    expect(refined.violations).toEqual([]);
  });

  it("forwards onReasoning to the refinement chat call", async () => {
    chatMock.mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT));
    const onReasoning = vi.fn();
    await refinePlan(PRIOR_PLAN, "no-op refinement", { onReasoning });
    const req = chatMock.mock.calls[0]![0] as { onReasoning?: unknown };
    expect(req.onReasoning).toBe(onReasoning);
  });

  it("re-runs the post-validators and surfaces violations on the refined plan", async () => {
    const badRefined = {
      ...CLEAN_PLAN_DRAFT,
      tools: [
        { ...CLEAN_PLAN_DRAFT.tools[0]!, name: "manage_orders" },
        CLEAN_PLAN_DRAFT.tools[1]!,
      ],
    };
    chatMock.mockResolvedValueOnce(chatResponse(badRefined));

    const refined = await refinePlan(PRIOR_PLAN, "rename to manage_orders");
    expect(refined.violations.some((v) => v.code === "TOOL_NAME_BANNED_PREFIX")).toBe(true);
  });

  it("retries once on bad JSON then succeeds", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce(chatResponse(CLEAN_PLAN_DRAFT));

    const refined = await refinePlan(PRIOR_PLAN, "anything");
    expect(refined.serverName).toBe("orders-mcp");
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("throws AgentInvalidOutputError when refinement fails twice", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce({ content: "still not json", finishReason: "stop" });

    await expect(refinePlan(PRIOR_PLAN, "x")).rejects.toBeInstanceOf(AgentInvalidOutputError);
  });
});
