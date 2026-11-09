import { expect, test } from "@playwright/test";

test("application entrypoint mounts the public website without the startup error screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root .site-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The website could not start" })).toHaveCount(0);
});
