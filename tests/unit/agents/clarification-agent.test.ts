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

import {
  runClarificationTurn,
  AgentInvalidOutputError,
} from "@/lib/agents/clarification-agent";

const CLEAN_FACTS = {
  serverName: "orders-mcp",
  purpose: "Read-only access to orders and shipments for internal agents.",
  boundedContext: "orders",
  dataSources: [{ name: "orders_db", classification: "internal" as const }],
  externalServices: [],
  proposedTools: [
    {
      name: "get_order",
      description: "Returns a single order by its unique identifier.",
      safetyClass: "read" as const,
      idempotent: true,
      inputs: [
        {
          name: "order_id",
          type: "string" as const,
          required: true,
          description: "The unique order identifier.",
        },
      ],
      outputShape: "{ id, status, line_items[] }",
      failureModes: ["not_found", "validation"],
      requiredScopes: ["orders:read"],
    },
  ],
};

const CLEAN_QUESTION = {
  nextQuestion: "What scopes should the orders:read role include?",
  completenessScore: 0.8,
  readyForPlan: false,
};

function chatResponse(payload: unknown): { content: string; finishReason: string } {
  return { content: JSON.stringify(payload), finishReason: "stop" };
}

beforeEach(() => {
  chatMock.mockReset();
});

describe("runClarificationTurn", () => {
  it("happy path: extract → validate → advise → question", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "I want a read-only orders MCP",
      priorFacts: {},
    });

    expect(chatMock).toHaveBeenCalledTimes(3);
    expect(result.extractedFacts.serverName).toBe("orders-mcp");
    expect(result.violations).toEqual([]);
    expect(result.advisories).toEqual([]);
    expect(result.nextQuestion).toBe(CLEAN_QUESTION.nextQuestion);
    expect(result.readyForPlan).toBe(false);
  });

  it("surfaces deterministic violations from the validator step", async () => {
    chatMock
      .mockResolvedValueOnce(
        chatResponse({
          ...CLEAN_FACTS,
          serverName: "orders",
          proposedTools: [
            { ...CLEAN_FACTS.proposedTools[0], name: "manage_orders" },
          ],
        }),
      )
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });

    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain("SERVER_NAME_INVALID");
    expect(codes).toContain("TOOL_NAME_BANNED_PREFIX");
  });

  it("returns LLM advisories from the advise step", async () => {
    const adv = {
      topic: "pagination" as const,
      severity: "suggestion" as const,
      path: "tools[0]",
      message: "list_orders returns potentially large result sets — consider limit + cursor.",
      section: "§8.5",
    };
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [adv] }))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.advisories).toHaveLength(1);
    expect(result.advisories[0]!.topic).toBe("pagination");
  });

  it("retries extract once on malformed JSON then succeeds", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.extractedFacts.serverName).toBe("orders-mcp");
    expect(chatMock).toHaveBeenCalledTimes(4);
  });

  it("throws AgentInvalidOutputError when extract fails twice", async () => {
    chatMock
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce({ content: "still not json", finishReason: "stop" });

    await expect(
      runClarificationTurn({ history: [], userMessage: "...", priorFacts: {} }),
    ).rejects.toBeInstanceOf(AgentInvalidOutputError);
  });

  it("advise failure is non-blocking — returns empty advisories", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockRejectedValueOnce(new Error("groq 500"))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.advisories).toEqual([]);
    expect(result.nextQuestion).toBe(CLEAN_QUESTION.nextQuestion);
  });

  it("advise malformed JSON returns empty advisories, not an error", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce({ content: "garbage", finishReason: "stop" })
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.advisories).toEqual([]);
  });

  it("redacts secrets in user input before any Groq call sees them", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    await runClarificationTurn({
      history: [{ role: "user", content: "I have AKIAIOSFODNN7EXAMPLE in config" }],
      userMessage: "and token gsk_aBcDeFgHiJkLmNoPqRsTuVwXyZ here",
      priorFacts: {},
    });

    const allMessageContent = chatMock.mock.calls
      .flatMap((call) => (call[0] as { messages: { content: string }[] }).messages)
      .map((m) => m.content)
      .join("\n");
    expect(allMessageContent).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(allMessageContent).not.toContain("gsk_aBcDeFgHiJkLmNoPqRsTuVwXyZ");
    expect(allMessageContent).toContain("[AWS_KEY]");
    expect(allMessageContent).toContain("[GROQ_KEY]");
  });

  it("readyForPlan = true and nextQuestion = null when the question step says so", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce(
        chatResponse({
          nextQuestion: null,
          completenessScore: 0.95,
          readyForPlan: true,
        }),
      );

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.readyForPlan).toBe(true);
    expect(result.nextQuestion).toBeNull();
  });

  it("retries question step once on bad JSON then succeeds", async () => {
    chatMock
      .mockResolvedValueOnce(chatResponse(CLEAN_FACTS))
      .mockResolvedValueOnce(chatResponse({ advisories: [] }))
      .mockResolvedValueOnce({ content: "not json", finishReason: "stop" })
      .mockResolvedValueOnce(chatResponse(CLEAN_QUESTION));

    const result = await runClarificationTurn({
      history: [],
      userMessage: "...",
      priorFacts: {},
    });
    expect(result.nextQuestion).toBe(CLEAN_QUESTION.nextQuestion);
    expect(chatMock).toHaveBeenCalledTimes(4);
  });
});
