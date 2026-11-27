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

test("floating WhatsApp and Ask Assistant controls stay on opposite edges on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  const whatsapp = page.locator(".floating-whatsapp");
  const assistant = page.locator(".customer-chat-launcher");
  await expect(whatsapp).toBeVisible();
  await expect(assistant).toBeVisible();

  const assertOppositeEdges = async () => {
    const positions = await page.evaluate(() => {
      const wa = document.querySelector(".floating-whatsapp")?.getBoundingClientRect();
      const chat = document.querySelector(".customer-chat-launcher")?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        whatsapp: wa ? { left: wa.left, right: wa.right } : null,
        assistant: chat ? { left: chat.left, right: chat.right } : null,
      };
    });
    expect(positions.whatsapp).not.toBeNull();
    expect(positions.assistant).not.toBeNull();
    expect(positions.whatsapp!.left).toBeLessThan(positions.viewportWidth / 2);
    expect(positions.assistant!.right).toBeGreaterThan(positions.viewportWidth / 2);
    expect(positions.whatsapp!.right).toBeLessThan(positions.assistant!.left);
  };

  await assertOppositeEdges();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertOppositeEdges();
});
