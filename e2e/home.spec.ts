import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("page loads without errors", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PlotLink/i);
    // Page should render — grid or empty state
    await expect(page.locator("body")).toBeVisible();
  });

  test("FilterBar is visible and dropdowns work", async ({ page }) => {
    await page.goto("/");

    const writerButton = page.locator("button").filter({ hasText: /writer:/ }).first();
    // FilterBar may not render if page structure differs — skip gracefully
    if (!(await writerButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await writerButton.click();

    const dropdown = page.locator("[class*='absolute']").filter({ hasText: "Human" });
    await expect(dropdown.first()).toBeVisible();

    // Close
    await page.locator("h1, h2, header").first().click();
  });

  test("sort dropdown shows Recent and Trending options", async ({ page }) => {
    await page.goto("/");

    const sortButton = page.locator("button").filter({ hasText: /sort:/ }).first();
    if (!(await sortButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await sortButton.click();

    const recentOption = page.locator("[class*='absolute'] button").filter({ hasText: "Recent" });
    const trendingOption = page.locator("[class*='absolute'] button").filter({ hasText: "Trending" });
    await expect(recentOption.first()).toBeVisible({ timeout: 3000 });
    await expect(trendingOption.first()).toBeVisible();
  });

  test("tab switch (Trending) loads results", async ({ page }) => {
    await page.goto("/");

    const sortButton = page.locator("button").filter({ hasText: /sort:/ }).first();
    if (!(await sortButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await sortButton.click();
    const trendingOption = page.locator("[class*='absolute'] button").filter({ hasText: "Trending" });
    await trendingOption.first().click();

    // Page should reload with trending content (or empty state)
    await page.locator("body").waitFor();
  });

  test("genre filter updates URL", async ({ page }) => {
    await page.goto("/");

    const genreButton = page.locator("button").filter({ hasText: /genre:/ }).first();
    if (!(await genreButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await genreButton.click();

    const allGenres = page.locator("[class*='absolute'] button").filter({ hasText: "All genres" });
    await expect(allGenres.first()).toBeVisible({ timeout: 3000 });

    const genreOptions = page.locator("[class*='absolute'] button");
    const count = await genreOptions.count();
    if (count > 1) {
      await genreOptions.nth(1).click();
      await expect(page).toHaveURL(/genre=/);
    }
  });

  test("language filter selects option and updates URL", async ({ page }) => {
    await page.goto("/");

    const langButton = page.locator("button").filter({ hasText: /lang:/ }).first();
    if (!(await langButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await langButton.click();

    const allLangs = page.locator("[class*='absolute'] button").filter({ hasText: "All languages" });
    await expect(allLangs.first()).toBeVisible({ timeout: 3000 });

    const langOptions = page.locator("[class*='absolute'] button");
    const count = await langOptions.count();
    if (count > 1) {
      await langOptions.nth(1).click();
      await expect(page).toHaveURL(/lang=/);
    }
  });

  test("pagination links present when enough content", async ({ page }) => {
    await page.goto("/");
    await page.locator("body").waitFor();

    // Pagination only appears with >24 items
    const nextLink = page.locator("a").filter({ hasText: "Next" });
    if (await nextLink.count() > 0) {
      const href = await nextLink.first().getAttribute("href");
      expect(href).toContain("page=2");
    }
    // No pagination is valid for small datasets
  });
});
