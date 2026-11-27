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


test("floating WhatsApp support stays on the left edge on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  const whatsapp = page.locator(".floating-whatsapp");
  await expect(whatsapp).toBeVisible();
  const desktopPosition = await whatsapp.evaluate((element) => {
    const style = getComputedStyle(element);
    return { left: style.left, right: style.right };
  });
  expect(desktopPosition.left).not.toBe("auto");
  expect(desktopPosition.right).toBe("auto");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePosition = await whatsapp.evaluate((element) => {
    const style = getComputedStyle(element);
    return { left: style.left, right: style.right };
  });
  expect(mobilePosition.left).not.toBe("auto");
  expect(mobilePosition.right).toBe("auto");
});
