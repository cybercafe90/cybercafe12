import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/services",
  "/services/insurance",
  "/challan",
  "/insurance",
  "/apply",
  "/track",
  "/dashboard",
  "/contact",
  "/privacy",
  "/terms",
  "/pay",
  "/admin/login",
  "/grievance",
  "/insurance/admin",
];

test("all public and restricted portal routes avoid horizontal overflow", async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.document,
      `Unexpected horizontal overflow on ${route}: ${dimensions.document}px > ${dimensions.viewport}px`,
    ).toBeLessThanOrEqual(dimensions.viewport);
  }
});
