import { test, expect } from '@playwright/test'
import { createAdminFamily } from '../db/fixtures'

test.describe('smoke', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('admin email sign-in reaches home with unallocated', async ({ page }) => {
    const family = await createAdminFamily('e2e-admin')

    await page.goto('/login')
    await page.locator('#login-email').fill(family.adminEmail)
    await page.locator('#login-password').fill(family.adminPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByLabel('Unallocated balance')).toBeVisible()
  })

  test('forgot password page loads from login', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: /forgot password/i }).click()
    await expect(page).toHaveURL(/\/login\/forgot/)
  })
})
