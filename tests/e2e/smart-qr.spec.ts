import { expect, test } from "@playwright/test";

test("merchant registration collects explicit monthly consent and shows the Shop ID", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/smart-qr/register", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Application received. Check your email to set a password and verify your address.",
        shopCode: "BBC-TEST123",
      }),
    });
  });

  await page.goto("/smart-qr");
  await expect(page.getByRole("heading", { name: "Make it easy for customers to find you." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Merchant application" })).toBeVisible();

  await page.getByLabel("Owner's full name").fill("Test Shop Owner");
  await page.getByLabel("Email address").fill("shop-owner@example.com");
  await page.getByLabel("Shop name").fill("Test Shop");

  await page.getByRole("button", { name: /Growth/ }).click();
  await page.getByLabel("Monthly subscription").selectOption("growth");
  const submit = page.getByRole("button", { name: "Submit merchant application" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText(/Your Shop ID is BBC-TEST123/)).toBeVisible();
  expect(submitted).toMatchObject({
    ownerName: "Test Shop Owner",
    email: "shop-owner@example.com",
    shopName: "Test Shop",
    plan: "growth",
    monthlyOption: "growth",
    monthlyConsent: true,
  });
});

test("system readiness page never needs to display secret values", async ({ page }) => {
  await page.route("**/api/smart-qr/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        database: true,
        schema: true,
        emailReady: false,
        paymentsReady: false,
        livePaymentsEnabled: false,
        ownerBootstrapReady: false,
      }),
    });
  });

  await page.goto("/smart-qr/system-check");
  await expect(page.getByRole("heading", { name: "System readiness" })).toBeVisible();
  await expect(page.getByText("Smart QR database")).toBeVisible();
  await expect(page.getByText("Email delivery secret")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();
  await expect(page.getByText(/Credentials are never displayed/)).toBeVisible();
});
