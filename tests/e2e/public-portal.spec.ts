import { expect, test } from "@playwright/test";

test("public navigation and service search work without backend credentials", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/BABA'S CYBER CAFE/);
  const menuToggle = page.getByRole("button", { name: "Open menu" });
  if (await menuToggle.isVisible()) await menuToggle.click();
  await page.getByRole("link", { name: "Services", exact: true }).click();
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
    page.getByText("1 service in the initial catalogue"),
  ).toBeVisible();
});

test("service pages and enquiry controls remain usable on mobile", async ({
  page,
}) => {
  await page.goto("/services/insurance");
  await expect(page.getByRole("heading", { name: "Insurance" })).toBeVisible();
  await expect(page.locator(".service-card")).toHaveCount(14);
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
  await expect(
    page.getByText(/Secure online submissions are not configured yet/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Submit enquiry/ }),
  ).toBeDisabled();
  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
});

test("tracking and admin do not offer unauthenticated write paths", async ({
  page,
}) => {
  await page.goto("/track");
  await expect(
    page.getByRole("button", { name: /View application status/ }),
  ).toBeDisabled();
  await page.goto("/admin/login");
  await expect(
    page.getByText("There is no public registration."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sign in securely/ }),
  ).toBeDisabled();
});
