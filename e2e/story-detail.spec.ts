import { test, expect } from "@playwright/test";

test.describe("Story Detail Page", () => {
  // Navigate from home to the first story to get a valid storyline ID
  test("page loads from home page link", async ({ page }) => {
    await page.goto("/");
    // Wait for story grid to render
    const storyLink = page.locator("a[href^='/story/']").first();
    await expect(storyLink).toBeVisible({ timeout: 15000 });

    // Click first story card
    await storyLink.click();
    await expect(page).toHaveURL(/\/story\/\d+/);

    // Story page should render with a heading
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("no console errors on story page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate to first story from home
    await page.goto("/");
    const storyLink = page.locator("a[href^='/story/']").first();
    await expect(storyLink).toBeVisible({ timeout: 15000 });
    await storyLink.click();
    await page.waitForTimeout(3000);

    // Filter out known benign errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes("Failed to fetch") &&
        !e.includes("net::ERR") &&
        !e.includes("Hydration") &&
        !e.includes("Warning:") &&
        !e.includes("RPC") &&
        !e.includes("favicon"),
    );

    expect(realErrors).toEqual([]);
  });
});
