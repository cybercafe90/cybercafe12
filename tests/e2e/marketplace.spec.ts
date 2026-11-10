import { expect, test } from '@playwright/test'

test('marketplace storefront and core navigation render on desktop and mobile', async ({ page }) => {
  await page.goto('/marketplace')
  await expect(page.getByRole('heading', { name: /Discover something special/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Seller portal/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Track order/i })).toBeVisible()
  const viewport = await page.evaluate(() => document.documentElement.clientWidth)
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(documentWidth).toBeLessThanOrEqual(viewport)
})

test('seller portal keeps account registration separate from owner approval', async ({ page }) => {
  await page.goto('/marketplace/seller')
  await expect(page.getByRole('heading', { name: 'Open your marketplace store' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Seller sign in/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Create seller account/i })).toBeVisible()
  await expect(page.getByText(/reviewed and approved by BABA'S CYBER CAFE/i)).toBeVisible()
})

test('marketplace owner workspace requires existing owner authentication', async ({ page }) => {
  await page.goto('/marketplace/admin')
  await expect(page.getByRole('heading', { name: 'Marketplace administration' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Owner sign-in required' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open secure owner sign-in/i })).toHaveAttribute('href', '/admin/login')
})

test('marketplace order tracking requires order reference and registered mobile', async ({ page }) => {
  await page.goto('/marketplace/orders')
  await expect(page.getByRole('heading', { name: 'Track your marketplace order' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Order reference' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Registered mobile number' })).toBeVisible()
})
