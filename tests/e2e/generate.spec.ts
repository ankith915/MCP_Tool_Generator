import { test, expect } from "@playwright/test";
import path from "node:path";
import AdmZip from "adm-zip";

const VALID_SERVER_NAME = "my-mcp-server";
const VALID_DISPLAY_NAME = "My MCP Server";
const VALID_DESCRIPTION = "A test MCP server for e2e validation";
const VALID_TOOL_NAME = "get_greeting";
const VALID_TOOL_DESC = "Returns a personalised greeting for the given name";
const VALID_PARAM_NAME = "name";
const VALID_PARAM_DESC = "The name to greet";

test.describe("MCP Tool Generator wizard", () => {
  test("navigates through all five steps via URL query param", async ({ page }) => {
    await page.goto("/generate");
    await expect(page).toHaveURL(/step=identity|\/generate$/);

    // Step 1 renders identity fields
    await expect(page.getByLabel("Package name")).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();

    // URL param defaults to identity
    await page.goto("/generate?step=capabilities");
    await expect(page.getByLabel("Tool name")).toBeVisible();

    await page.goto("/generate?step=io");
    await expect(page.getByLabel("Log level")).toBeVisible();

    await page.goto("/generate?step=transport");
    await expect(page.getByLabel("Port")).toBeVisible();

    await page.goto("/generate?step=review");
    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  });

  test("Next validates the current step and blocks navigation on error", async ({
    page,
  }) => {
    await page.goto("/generate?step=identity");

    // Leave all required fields empty and click Next
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Validation must block navigation — we're still on identity
    await expect(page).toHaveURL(/step=identity|\/generate$/);
    // Identity step heading is still visible (we didn't navigate away)
    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
  });

  test("fills identity step and advances to capabilities via Next", async ({
    page,
  }) => {
    await page.goto("/generate?step=identity");

    await page.getByLabel("Package name").fill(VALID_SERVER_NAME);
    await page.getByLabel("Display name").fill(VALID_DISPLAY_NAME);
    await page.getByLabel("Description").fill(VALID_DESCRIPTION);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page).toHaveURL(/step=capabilities/);
    await expect(page.getByLabel("Tool name")).toBeVisible();
  });

  test("Back button returns to previous step", async ({ page }) => {
    await page.goto("/generate?step=capabilities");

    // Sidebar click on completed steps works; or use browser history
    await page.goto("/generate?step=identity");
    await page.getByLabel("Package name").fill(VALID_SERVER_NAME);
    await page.getByLabel("Display name").fill(VALID_DISPLAY_NAME);
    await page.getByLabel("Description").fill(VALID_DESCRIPTION);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/step=capabilities/);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/step=identity/);
    // Previously entered values should still be there
    await expect(page.getByLabel("Package name")).toHaveValue(VALID_SERVER_NAME);
  });

  test("review step shows summary of entered data", async ({ page }) => {
    // Fill all steps in sequence
    await page.goto("/generate?step=identity");
    await page.getByLabel("Package name").fill(VALID_SERVER_NAME);
    await page.getByLabel("Display name").fill(VALID_DISPLAY_NAME);
    await page.getByLabel("Description").fill(VALID_DESCRIPTION);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Capabilities
    await expect(page).toHaveURL(/step=capabilities/);
    await page.getByLabel("Tool name").fill(VALID_TOOL_NAME);
    await page.getByLabel("Tool description").fill(VALID_TOOL_DESC);
    await page.getByRole("button", { name: "Add parameter" }).click();
    await page.getByPlaceholder("query").fill(VALID_PARAM_NAME);
    await page.getByPlaceholder("What this parameter represents").fill(VALID_PARAM_DESC);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // I/O
    await expect(page).toHaveURL(/step=io/);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Transport
    await expect(page).toHaveURL(/step=transport/);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Review
    await expect(page).toHaveURL(/step=review/);
    await expect(page.getByText(VALID_SERVER_NAME)).toBeVisible();
    await expect(page.getByText(VALID_TOOL_NAME)).toBeVisible();
    await expect(page.getByText("Streamable HTTP")).toBeVisible();
  });

  // Download test only runs when DATABASE_URL is available (CI)
  test("download produces a ZIP with correct project files", async ({
    page,
  }) => {
    test.skip(
      !process.env["DATABASE_URL"],
      "Requires DATABASE_URL — runs in CI only",
    );

    // Fill all steps
    await page.goto("/generate?step=identity");
    await page.getByLabel("Package name").fill(VALID_SERVER_NAME);
    await page.getByLabel("Display name").fill(VALID_DISPLAY_NAME);
    await page.getByLabel("Description").fill(VALID_DESCRIPTION);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page).toHaveURL(/step=capabilities/);
    await page.getByLabel("Tool name").fill(VALID_TOOL_NAME);
    await page.getByLabel("Tool description").fill(VALID_TOOL_DESC);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/step=io/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/step=transport/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/step=review/);

    // Trigger download and capture it
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download ZIP" }).click();
    const download = await downloadPromise;

    const zipPath = path.join(
      path.dirname(download.suggestedFilename()),
      download.suggestedFilename(),
    );
    await download.saveAs(zipPath);

    // Inspect ZIP contents
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().map((e) => e.entryName);

    expect(entries).toEqual(
      expect.arrayContaining([
        "src/index.ts",
        "package.json",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "README.md",
      ]),
    );

    const pkgJson = JSON.parse(
      zip.readAsText("package.json"),
    ) as Record<string, unknown>;
    const deps = pkgJson["dependencies"] as Record<string, string>;
    expect(deps["@modelcontextprotocol/sdk"]).toBe("1.29.0");

    const indexTs = zip.readAsText("src/index.ts");
    expect(indexTs).toContain("WebStandardStreamableHTTPServerTransport");
    expect(indexTs).toContain(VALID_TOOL_NAME);
  });
});
