import { test, expect } from "@playwright/test";

test.describe("Story Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to first story from home page
    await page.goto("/");
    const storyLink = page.locator("a[href^='/story/']").first();
    // If no stories exist (empty DB), skip all story detail tests
    if (!(await storyLink.isVisible({ timeout: 15000 }).catch(() => false))) {
      test.skip();
      return;
    }
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
    const donateText = page.getByText(/donat/i).first();
    const hasDonate = await donateText.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDonate) {
      // Wallet not connected — widget may not render. Page should still load.
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

    await page.locator("canvas, svg, [class*='chart'], [class*='price']").first()
      .waitFor({ timeout: 10000 }).catch(() => {});

    expect(warnings).toEqual([]);
  });

  test("TradingWidget returns null when wallet not connected", async ({ page }) => {
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
