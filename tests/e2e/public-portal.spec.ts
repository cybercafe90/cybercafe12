import { expect, test } from "@playwright/test";

const backendConfigured = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY,
);

test("public navigation and service search work with either backend mode", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/BABA'S CYBER CAFE/);
  const menuToggle = page.getByRole("button", { name: "Open menu" });
  if (await menuToggle.isVisible()) await menuToggle.click();
  await page.getByRole("link", { name: "Services Hub", exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(
    page.getByRole("heading", { name: "Find the right assistance." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search services by name" })
    .fill("Domicile Certificate");
  await expect(
    page.getByRole("heading", { name: "Domicile Certificate" }),
  ).toBeVisible();
  await expect(page.locator(".service-card")).toHaveCount(1);
  await expect(
    page.getByText(/^1 service in the (initial|live) catalogue$/),
  ).toBeVisible();
});

test("service pages and enquiry controls remain usable on mobile", async ({
  page,
}) => {
  await page.goto("/services/insurance");
  await expect(
    page.getByRole("heading", { name: "Insurance", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".service-card")).toHaveCount(12);
  await expect(
    page.getByText(/^14 services in the (initial|live) catalogue$/),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".service-card")).toHaveCount(2);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  const serviceViewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const serviceDocumentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(serviceDocumentWidth).toBeLessThanOrEqual(serviceViewportWidth);

  await page.goto("/apply");
  await expect(
    page.getByRole("heading", { name: "Let's get you to the right place." }),
  ).toBeVisible();
  const submitButton = page.getByRole("button", { name: /Submit enquiry/ });
  if (backendConfigured) {
    await expect(
      page.getByText(/Secure online submissions are not configured yet/),
    ).toHaveCount(0);
    await expect(submitButton).toBeEnabled();
  } else {
    await expect(
      page.getByText(/Secure online submissions are not configured yet/),
    ).toBeVisible();
    await expect(submitButton).toBeDisabled();
  }
  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
});

test("tracking follows backend configuration and admin remains owner-only", async ({
  page,
}) => {
  await page.goto("/track");
  const trackingButton = page.getByRole("button", {
    name: /View application status/,
  });
  if (backendConfigured) await expect(trackingButton).toBeEnabled();
  else await expect(trackingButton).toBeDisabled();
  await page.goto("/admin/login");
  await expect(
    page.getByText("There is no public registration."),
  ).toBeVisible();
  const signInButton = page.getByRole("button", { name: /Sign in securely/ });
  if (backendConfigured) await expect(signInButton).toBeEnabled();
  else await expect(signInButton).toBeDisabled();
});

test("admin password recovery uses a generic confirmation and safe redirect", async ({
  page,
}) => {
  test.skip(!backendConfigured, "requires configured Supabase client");
  let recoveryUrl = "";
  await page.route("**/auth/v1/recover**", async (route) => {
    recoveryUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto("/admin/login");
  await page
    .getByRole("textbox", { name: "Verified email" })
    .fill("support@babacybercafe.in");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(
    page.getByText("If the account exists, password reset instructions were sent."),
  ).toBeVisible();
  const callbackUrl = new URL(recoveryUrl).searchParams.get("redirect_to");
  expect(callbackUrl).toBe(`${new URL(page.url()).origin}/admin/login`);
});

test("insurance quotation, payment and customer upload controls remain responsive", async ({ page }) => {
  await page.goto("/insurance");
  await expect(page.getByRole("heading", { name: "Request an insurance quotation." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit quotation request/ })).toBeVisible();
  await expect(page.locator(".insurance-premium")).toHaveCount(0);
  let viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  let documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

  await page.goto("/insurance/admin");
  await expect(page.getByRole("heading", { name: "Insurance quotation desk" })).toBeVisible();
  await expect(page.getByText("Owner sign-in required")).toBeVisible();

  await page.goto("/pay");
  await expect(page.getByRole("heading", { name: "Application payment" })).toBeVisible();
  viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

  await page.goto("/apply");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
});


test("customer dashboard provides the self-service journeys", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Your service requests, in one place." }),
  ).toBeVisible();
  await expect(page.locator(".customer-hub-card")).toHaveCount(4);
  await expect(page.getByRole("link", { name: /Submit an enquiry/ })).toHaveAttribute("href", "/apply");
  await expect(page.getByRole("link", { name: /Track application/ })).toHaveAttribute("href", "/track");
  await expect(page.getByRole("link", { name: /Browse catalogue/ })).toHaveAttribute("href", "/services");
  await expect(page.getByRole("link", { name: /Open grievance desk/ })).toHaveAttribute("href", "/grievance");
  await expect(page.getByRole("link", { name: /WhatsApp support/ })).toHaveAttribute("href", "https://wa.me/917006865909");
});

test("mobile app manifest and icons are available", async ({ page }) => {
  await page.goto("/");
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("BABA'S CYBER CAFE");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#c9a45c");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(icon.src);
    expect(iconResponse.ok(), `Missing app icon: ${icon.src}`).toBeTruthy();
  }
});

test("investigation portal denies unauthenticated visitors", async ({ page }) => {
  await page.goto("/investigation");
  await expect(
    page.getByRole("heading", { name: "Investigation portal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Restricted access" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to secure sign-in" }),
  ).toHaveAttribute("href", "/admin/login");
  await expect(
    page.getByRole("heading", { name: "Security events" }),
  ).toHaveCount(0);
});
