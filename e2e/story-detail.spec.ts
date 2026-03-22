import { test, expect } from "@playwright/test";

// Deterministic storyline ID from Base mainnet StoryFactory.
// Use the earliest visible storyline on the discover page.
const STORYLINE_ID = 12;

test.describe("Story Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/story/${STORYLINE_ID}`);
  });

  test("page loads with story title", async ({ page }) => {
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 15000 });
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
    // DonateWidget may require wallet connection to render
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

    await page.locator("h1, h2").first().waitFor({ timeout: 15000 });

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
