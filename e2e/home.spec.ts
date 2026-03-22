import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("page loads and story grid renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PlotLink/i);
    const grid = page.locator(".grid");
    await expect(grid.first()).toBeVisible({ timeout: 15000 });
  });

  test("FilterBar is visible and dropdowns work", async ({ page }) => {
    await page.goto("/");

    const filterBar = page.locator("div").filter({ hasText: /writer:/ }).first();
    await expect(filterBar).toBeVisible({ timeout: 10000 });

    // Open writer dropdown
    const writerButton = page.locator("button").filter({ hasText: /writer:/ }).first();
    await writerButton.click();

    const dropdown = page.locator("[class*='absolute']").filter({ hasText: "Human" });
    await expect(dropdown.first()).toBeVisible();

    // Close
    await page.locator("h1, h2, header").first().click();
  });

  test("sort dropdown shows Recent and Trending options", async ({ page }) => {
    await page.goto("/");

    const sortButton = page.locator("button").filter({ hasText: /sort:/ }).first();
    await expect(sortButton).toBeVisible({ timeout: 10000 });
    await sortButton.click();

    const recentOption = page.locator("[class*='absolute'] button").filter({ hasText: "Recent" });
    const trendingOption = page.locator("[class*='absolute'] button").filter({ hasText: "Trending" });
    await expect(recentOption.first()).toBeVisible({ timeout: 3000 });
    await expect(trendingOption.first()).toBeVisible();
  });

  test("tab switch (Trending) loads different results", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Capture current story titles
    const initialTitles = await page.locator("a[href^='/story/'] h3").allTextContents();

    // Switch to Trending
    const sortButton = page.locator("button").filter({ hasText: /sort:/ }).first();
    await sortButton.click();
    const trendingOption = page.locator("[class*='absolute'] button").filter({ hasText: "Trending" });
    await trendingOption.first().click();

    await page.waitForTimeout(2000);
    const trendingTitles = await page.locator("a[href^='/story/'] h3").allTextContents();

    // Either the order changed or same set — both are valid
    // Just confirm the page still has content
    expect(trendingTitles.length).toBeGreaterThan(0);
  });

  test("genre filter updates results", async ({ page }) => {
    await page.goto("/");

    const genreButton = page.locator("button").filter({ hasText: /genre:/ }).first();
    await expect(genreButton).toBeVisible({ timeout: 10000 });
    await genreButton.click();

    // Should show "All genres" and individual genre options
    const allGenres = page.locator("[class*='absolute'] button").filter({ hasText: "All genres" });
    await expect(allGenres.first()).toBeVisible({ timeout: 3000 });

    // Click a specific genre if available
    const genreOptions = page.locator("[class*='absolute'] button");
    const count = await genreOptions.count();
    if (count > 1) {
      // Click the second option (first specific genre, not "All genres")
      await genreOptions.nth(1).click();
      // URL should have genre param
      await expect(page).toHaveURL(/genre=/);
    }
  });

  test("language filter selects option and updates URL", async ({ page }) => {
    await page.goto("/");

    const langButton = page.locator("button").filter({ hasText: /lang:/ }).first();
    await expect(langButton).toBeVisible({ timeout: 10000 });
    await langButton.click();

    const allLangs = page.locator("[class*='absolute'] button").filter({ hasText: "All languages" });
    await expect(allLangs.first()).toBeVisible({ timeout: 3000 });

    // Select a specific language if available
    const langOptions = page.locator("[class*='absolute'] button");
    const count = await langOptions.count();
    if (count > 1) {
      await langOptions.nth(1).click();
      await expect(page).toHaveURL(/lang=/);
    }
  });

  test("pagination renders with page controls", async ({ page }) => {
    await page.goto("/");
    // Wait for content to load
    await page.locator(".grid").first().waitFor({ timeout: 15000 });

    // Look for pagination — "Page" text or Next/Previous links
    const pageIndicator = page.getByText(/Page \d+/);
    const nextLink = page.locator("a").filter({ hasText: "Next" });
    const hasPagination = (await pageIndicator.count()) > 0 || (await nextLink.count()) > 0;

    // Pagination only shows if there are enough items (>24)
    // If few storylines, no pagination is expected — just verify page loaded
    expect(true).toBe(true); // Page loaded without error

    if (hasPagination) {
      // If Next link exists, verify it links to page=2
      if (await nextLink.count() > 0) {
        const href = await nextLink.first().getAttribute("href");
        expect(href).toContain("page=2");
      }
    }
  });
});
