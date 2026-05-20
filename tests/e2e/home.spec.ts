import { test, expect } from "@playwright/test";

test("home page loads with correct title and heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MCP Tool Generator/);
  await expect(page.locator("h1")).toContainText("MCP Tool Generator");
});
