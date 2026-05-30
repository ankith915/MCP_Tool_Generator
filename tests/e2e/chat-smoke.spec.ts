import { test, expect } from "@playwright/test";

const FAKE_SESSION_ID = "11111111-1111-4111-8111-111111111111";

test.describe("/generate/chat smoke", () => {
  test("renders chat UI, sends a message, surfaces agent reply", async ({ page }) => {
    // Stub session creation so we don't need real DB or dev-user rows.
    await page.route("**/api/v1/chat/sessions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, data: { sessionId: FAKE_SESSION_ID } }),
        });
      } else {
        await route.continue();
      }
    });

    // Stub the SSE message endpoint with canned clarification turn.
    await page.route("**/api/v1/chat/messages", async (route) => {
      const events = [
        `event: phase\ndata: ${JSON.stringify({ stage: "clarifying" })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          type: "clarification",
          payload: {
            extractedFacts: { serverName: "payments-mcp" },
            violations: [],
            advisories: [
              {
                topic: "bounded_context",
                severity: "info",
                message: "payments looks like a clean single bounded context.",
                section: "§5.3",
              },
            ],
            nextQuestion: "What data sources does this server read from?",
            completenessScore: 0.4,
            readyForPlan: false,
          },
        })}\n\n`,
      ].join("");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: events,
      });
    });

    await page.goto("/generate/chat");

    await expect(
      page.getByRole("heading", { name: "MCP Tool Generator — Chat" }),
    ).toBeVisible({ timeout: 10_000 });

    const composer = page.getByPlaceholder(/Describe the MCP server/);
    await expect(composer).toBeVisible();

    await composer.fill("I want an MCP server for our payments service");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("What data sources does this server read from?"),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("bounded_context")).toBeVisible();
  });

  test("does not expose the form wizard's URL or Approve button before plan exists", async ({
    page,
  }) => {
    await page.route("**/api/v1/chat/sessions", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { sessionId: FAKE_SESSION_ID } }),
      }),
    );

    await page.goto("/generate/chat");
    await expect(
      page.getByRole("heading", { name: "MCP Tool Generator — Chat" }),
    ).toBeVisible({ timeout: 10_000 });

    // No Approve button until a plan exists.
    await expect(page.getByRole("button", { name: /Approve/ })).toHaveCount(0);
  });
});
