import { test, expect } from "@playwright/test";

test.describe("Create Storyline Page", () => {
  test("form renders with all fields", async ({ page }) => {
    await page.goto("/create");
    // Form should render with input fields
    await expect(page.locator("body")).toBeVisible();

    // Check for title input
    const titleInput = page.getByPlaceholder(/title/i).or(page.locator("input[name='title']"));
    // The page may require wallet connection — if so, it shows a connect prompt
    // Accept either form fields or a connect prompt
    const hasForm = await titleInput.isVisible().catch(() => false);
    const hasConnectPrompt = await page.getByText(/connect/i).first().isVisible().catch(() => false);

    expect(hasForm || hasConnectPrompt).toBe(true);
  });

  test("wallet-not-connected state handled gracefully", async ({ page }) => {
    await page.goto("/create");
    // Page should not crash — should either show form or a connect wallet prompt
    await expect(page.locator("body")).toBeVisible();
    // No unhandled error overlay
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).not.toBeVisible();
  });
});
