import { test, expect, type Page } from "@playwright/test";

const PYTHON_SERVER_NAME = "my-python-server";
const PYTHON_DISPLAY_NAME = "My Python Server";
const PYTHON_DESCRIPTION = "A Python MCP server using FastMCP";
const PYTHON_TOOL_NAME = "get_data";
const PYTHON_TOOL_DESC =
  "Retrieves data from a given source based on the provided query";

const FASTAPI_SERVER_NAME = "my-fastapi-server";
const FASTAPI_DISPLAY_NAME = "My FastAPI Server";

// ---------------------------------------------------------------------------
// Shared helper — fills Steps 1–3 (Identity, Capabilities, I/O)
// ---------------------------------------------------------------------------

async function fillSteps1to3(
  page: Page,
  opts: { serverName: string; displayName: string; description: string },
) {
  // Step 1 — Identity
  await page.goto("/generate?step=identity");
  await page.getByLabel("Package name").fill(opts.serverName);
  await page.getByLabel("Display name").fill(opts.displayName);
  await page.getByLabel("Description").fill(opts.description);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2 — Capabilities
  await expect(page).toHaveURL(/step=capabilities/);
  await page.getByLabel("Tool name").fill(PYTHON_TOOL_NAME);
  await page.getByLabel("Tool description").fill(PYTHON_TOOL_DESC);
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 3 — I/O (leave defaults)
  await expect(page).toHaveURL(/step=io/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Python wizard paths", () => {
  test("Python FastMCP + Streamable HTTP path reaches the review page", async ({
    page,
  }) => {
    await fillSteps1to3(page, {
      serverName: PYTHON_SERVER_NAME,
      displayName: PYTHON_DISPLAY_NAME,
      description: PYTHON_DESCRIPTION,
    });

    // Step 4 — Transport
    await expect(page).toHaveURL(/step=transport/);

    // Select Python language
    await page.locator('input[name="language"][value="python"]').click();

    // Framework selector should become visible — select FastMCP
    await expect(
      page.locator('input[name="framework"][value="fastmcp"]'),
    ).toBeVisible();
    await page.locator('input[name="framework"][value="fastmcp"]').click();

    // Transport selector should be visible — select Streamable HTTP
    await expect(
      page.locator('input[name="transport"][value="streamable-http"]'),
    ).toBeVisible();
    await page
      .locator('input[name="transport"][value="streamable-http"]')
      .click();

    // Port and endpoint fields appear (Streamable HTTP defaults)
    await expect(page.getByLabel("Port")).toBeVisible();
    await expect(page.getByLabel("MCP endpoint path")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 5 — Review
    await expect(page).toHaveURL(/step=review/);
    await expect(
      page.getByRole("heading", { name: "Review" }),
    ).toBeVisible();

    // Review table should surface the server name and tool name we entered
    await expect(page.getByText(PYTHON_SERVER_NAME)).toBeVisible();
    await expect(page.getByText(PYTHON_TOOL_NAME)).toBeVisible();

    // Download ZIP button must be present (not necessarily clicked)
    await expect(
      page.getByRole("button", { name: "Download ZIP" }),
    ).toBeVisible();
  });

  test("Python FastAPI-MCP path shows existing-service checkbox and reaches review", async ({
    page,
  }) => {
    await fillSteps1to3(page, {
      serverName: FASTAPI_SERVER_NAME,
      displayName: FASTAPI_DISPLAY_NAME,
      description: PYTHON_DESCRIPTION,
    });

    // Step 4 — Transport
    await expect(page).toHaveURL(/step=transport/);

    // Select Python language
    await page.locator('input[name="language"][value="python"]').click();

    // Framework selector should appear — select FastAPI-MCP
    await expect(
      page.locator('input[name="framework"][value="fastapi-mcp"]'),
    ).toBeVisible();
    await page.locator('input[name="framework"][value="fastapi-mcp"]').click();

    // Transport selector must NOT be visible (auto-set to streamable-http)
    await expect(
      page.locator('input[name="transport"][value="streamable-http"]'),
    ).not.toBeVisible();
    await expect(
      page.locator('input[name="transport"][value="stdio"]'),
    ).not.toBeVisible();

    // "I have an existing FastAPI service" checkbox must be visible
    const existingServiceCheckbox = page.locator(
      'input[name="existingFastapiService"]',
    );
    await expect(existingServiceCheckbox).toBeVisible();

    // Check it
    await existingServiceCheckbox.check();
    await expect(existingServiceCheckbox).toBeChecked();

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step 5 — Review
    await expect(page).toHaveURL(/step=review/);
    await expect(
      page.getByRole("heading", { name: "Review" }),
    ).toBeVisible();

    // Review table should surface the server name we entered
    await expect(page.getByText(FASTAPI_SERVER_NAME)).toBeVisible();

    // Download ZIP button must be present
    await expect(
      page.getByRole("button", { name: "Download ZIP" }),
    ).toBeVisible();
  });
});
