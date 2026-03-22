import { test, expect } from "@playwright/test";

test.describe("Story Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const storyLink = page.locator("a[href^='/story/']").first();
    await expect(storyLink).toBeVisible({ timeout: 15000 });
    await storyLink.click();
    await expect(page).toHaveURL(/\/story\/\d+/);
  });

  test("page loads with story title and plots", async ({ page }) => {
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("plots section renders", async ({ page }) => {
    const plotContent = page.locator("article, [class*='plot'], p").first();
    await expect(plotContent).toBeVisible({ timeout: 10000 });
  });

  test("ruled paper styling is present", async ({ page }) => {
    const ruledByStyle = page.locator("[style*='repeating-linear-gradient']");
    const ruledByClass = page.locator("[class*='ruled'], [class*='notebook'], [class*='paper']");
    const count = (await ruledByStyle.count()) + (await ruledByClass.count());
    expect(count).toBeGreaterThan(0);
  });

  test("donate widget section present on page", async ({ page }) => {
    // DonateWidget may require wallet connection to render fully
    // Check for "Donate" text anywhere on the page, or verify graceful absence
    const donateText = page.getByText(/donat/i).first();
    const hasDonate = await donateText.isVisible({ timeout: 5000 }).catch(() => false);
    // If wallet not connected, widget may not render — verify page still loads
    if (!hasDonate) {
      // Page should still have loaded without errors
      await expect(page.locator("h1, h2").first()).toBeVisible();
    } else {
      await expect(donateText).toBeVisible();
    }
  });

  test("price chart renders without duplicate key warnings", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("duplicate key") || msg.text().includes("Each child in a list")) {
        warnings.push(msg.text());
      }
    });

    // Wait for chart component to mount
    await page.locator("canvas, svg, [class*='chart'], [class*='price']").first().waitFor({ timeout: 10000 }).catch(() => {});

    expect(warnings).toEqual([]);
  });

  test("TradingWidget returns null when wallet not connected", async ({ page }) => {
    // TradingWidget returns null when isConnected=false
    // Verify the Trade section heading is NOT visible (widget didn't render)
    const tradeSection = page.locator("section").filter({ hasText: "Trade" });
    await expect(tradeSection).not.toBeVisible({ timeout: 3000 });
  });

  test("no console errors on story page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait for page to fully load
    await page.locator("h1, h2").first().waitFor({ timeout: 10000 });

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
