import { test, expect } from '@playwright/test'
import { createAdminFamily } from '../db/fixtures'

test('admin tab renders content after sign-in', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  const family = await createAdminFamily('e2e-admin-page')

  await page.goto('/login')
  await page.locator('#login-email').fill(family.adminEmail)
  await page.locator('#login-password').fill(family.adminPassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page).toHaveURL('/admin')

  await expect(
    page.getByRole('heading', { name: 'Admin', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Money sources', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Household members' }),
  ).toBeVisible()

  expect(pageErrors).toEqual([])
})
