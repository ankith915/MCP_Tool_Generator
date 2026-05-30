import { describe, it, expect, beforeEach, vi } from "vitest";

const { generateTextMock, envMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  envMock: {
    OPENAI_API_KEY: "sk-test" as string | undefined,
    OPENAI_MAX_TOKENS: 4096,
    OPENAI_CLARIFY_MODEL: "gpt-4.1-mini",
    OPENAI_PLAN_MODEL: "o4-mini",
    OPENAI_CODEGEN_MODEL: "gpt-4.1-mini",
    CHAT_FLOW_ENABLED: true,
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (modelId: string) => ({ modelId }),
}));
vi.mock("ai", () => ({ generateText: generateTextMock }));

import { chat } from "@/lib/agents/llm";

beforeEach(() => {
  envMock.OPENAI_API_KEY = "sk-test";
  generateTextMock.mockReset();
  generateTextMock.mockResolvedValue({ text: '{"ok":true}', finishReason: "stop" });
});

function firstCallArgs(): Record<string, unknown> {
  return generateTextMock.mock.calls[0]![0] as Record<string, unknown>;
}

describe("chat (OpenAI via AI SDK)", () => {
  it("maps the model's text to content and surfaces finishReason", async () => {
    const r = await chat({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.content).toBe('{"ok":true}');
    expect(r.finishReason).toBe("stop");
  });

  it("sends temperature for standard models", async () => {
    await chat({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
    });
    expect(firstCallArgs().temperature).toBe(0.2);
  });

  it("omits temperature for reasoning models (o-series)", async () => {
    await chat({
      model: "o4-mini",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
    });
    expect("temperature" in firstCallArgs()).toBe(false);
  });

  it("passes maxOutputTokens from the request", async () => {
    await chat({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1234,
    });
    expect(firstCallArgs().maxOutputTokens).toBe(1234);
  });

  it("falls back to env OPENAI_MAX_TOKENS when no maxTokens given", async () => {
    await chat({ model: "gpt-4.1-mini", messages: [{ role: "user", content: "hi" }] });
    expect(firstCallArgs().maxOutputTokens).toBe(4096);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    envMock.OPENAI_API_KEY = undefined;
    await expect(
      chat({ model: "gpt-4.1-mini", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
