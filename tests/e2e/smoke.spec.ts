import { test, expect } from '@playwright/test'
import {
  APP_NAME,
  LOGIN_TAGLINE_LEAD,
  LOGIN_TAGLINE_PAYOFF,
} from '../../src/lib/brand'
import { createAdminFamily, insertBucket, serviceClient } from '../db/fixtures'

test.describe('smoke', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible()
    await expect(page.getByText(LOGIN_TAGLINE_LEAD)).toBeVisible()
    await expect(page.getByText(LOGIN_TAGLINE_PAYOFF)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Get started' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  })

  test('admin email sign-in reaches Buckets tab', async ({ page }) => {
    const family = await createAdminFamily('e2e-admin')

    await page.goto('/login')
    await page.locator('#login-email').fill(family.adminEmail)
    await page.locator('#login-password').fill(family.adminPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Buckets' })).toBeVisible()
    await expect(page.getByLabel('Add a money source')).toBeVisible()
  })

  test('forgot password page loads from login', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /forgot password/i }).click()
    await expect(page).toHaveURL(/\/login\/forgot/)
  })

  test('bucket rename and delete reflect immediately on Buckets tab', async ({
    page,
  }) => {
    const family = await createAdminFamily('e2e-bucket-ui')
    const svc = serviceClient()
    await insertBucket(svc, family.familyId, 'Old Name', null)
    await insertBucket(svc, family.familyId, 'Delete Me', null)

    await page.goto('/login')
    await page.locator('#login-email').fill(family.adminEmail)
    await page.locator('#login-password').fill(family.adminPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await expect(page.getByText('Old Name')).toBeVisible()
    await expect(page.getByText('Delete Me')).toBeVisible()

    const oldRow = page.getByRole('listitem').filter({ hasText: 'Old Name' })
    await oldRow.getByRole('button', { name: 'Bucket options' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    const renameInput = page.getByRole('listitem').getByRole('textbox')
    await renameInput.fill('Groceries')
    await renameInput.press('Enter')
    await expect(page.getByText('Groceries')).toBeVisible()
    await expect(page.getByText('Old Name')).not.toBeVisible()

    const deleteRow = page
      .getByRole('listitem')
      .filter({ hasText: 'Delete Me' })
    await deleteRow.getByRole('button', { name: 'Bucket options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    // Empty buckets delete immediately (no confirmation sheet).
    await expect(deleteRow).not.toBeVisible()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Groceries' }),
    ).toBeVisible()
  })
})
