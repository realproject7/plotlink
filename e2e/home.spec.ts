import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("page loads and story grid renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PlotLink/i);
    const grid = page.locator(".grid");
    await expect(grid.first()).toBeVisible({ timeout: 15000 });
  });

  test("FilterBar is visible and dropdowns work", async ({ page }) => {
    // Use desktop viewport so full labels show
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // FilterBar should be visible
    const filterBar = page.locator("div").filter({ hasText: /writer:/ }).first();
    await expect(filterBar).toBeVisible({ timeout: 10000 });

    // Click writer filter to open dropdown
    const writerButton = page.locator("button").filter({ hasText: /writer:/ }).first();
    await writerButton.click();

    // Dropdown should show options
    const dropdown = page.locator("[class*='absolute']").filter({ hasText: "Human" });
    await expect(dropdown.first()).toBeVisible();

    // Close by clicking body
    await page.locator("h1, h2, header").first().click();
  });

  test("sort dropdown shows Recent and Trending options", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    // Click sort filter
    const sortButton = page.locator("button").filter({ hasText: /sort:/ }).first();
    await expect(sortButton).toBeVisible({ timeout: 10000 });
    await sortButton.click();

    // Dropdown should show both options
    const recentOption = page.locator("[class*='absolute'] button").filter({ hasText: "Recent" });
    const trendingOption = page.locator("[class*='absolute'] button").filter({ hasText: "Trending" });
    await expect(recentOption.first()).toBeVisible({ timeout: 3000 });
    await expect(trendingOption.first()).toBeVisible();
  });

  test("genre filter opens dropdown with options", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    const genreButton = page.locator("button").filter({ hasText: /genre:/ }).first();
    await expect(genreButton).toBeVisible({ timeout: 10000 });
    await genreButton.click();

    // Dropdown should show "All genres" option
    const allGenresOption = page.locator("button").filter({ hasText: "All genres" });
    await expect(allGenresOption.first()).toBeVisible({ timeout: 3000 });
  });
});
