import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("NavBar logo links to home", async ({ page }) => {
    await page.goto("/create");
    const logo = page.getByText("PlotLink").first();
    await expect(logo).toBeVisible({ timeout: 10000 });
    await logo.click();
    await expect(page).toHaveURL("/");
  });

  test("NavBar Create link navigates to /create", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    const createLink = page.locator("a[href='/create']").first();
    await expect(createLink).toBeVisible({ timeout: 10000 });
    await createLink.click();
    await expect(page).toHaveURL("/create");
  });

  test("Footer renders with PlotLink branding", async ({ page }) => {
    await page.goto("/");
    // Footer contains "PlotLink" copyright text
    const footer = page.locator("footer");
    await expect(footer).toBeVisible({ timeout: 10000 });
    // Verify footer has expected content
    await expect(footer.getByText(/PlotLink/)).toBeVisible();
  });

  test("no console errors on navigation", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.locator(".grid").first().waitFor({ timeout: 15000 });

    // Navigate to create
    await page.goto("/create");
    await page.locator("body").waitFor();

    const realErrors = errors.filter(
      (e) =>
        !e.includes("Failed to fetch") &&
        !e.includes("net::ERR") &&
        !e.includes("Hydration") &&
        !e.includes("RPC") &&
        !e.includes("favicon"),
    );

    expect(realErrors).toEqual([]);
  });
});
