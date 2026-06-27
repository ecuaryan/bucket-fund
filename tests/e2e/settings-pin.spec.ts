import { test, expect, type Page } from '@playwright/test'
import { JOIN_CODE_LABEL } from '../../src/lib/brand'
import {
  addMember,
  createAdminFamily,
  familyJoinCode,
  setMemberPin,
} from '../db/fixtures'

/** Sign in via the family roster. Handles a fresh device (needs the join code) */
/** and an already-bound one (roster shows straight away). */
async function signInWithPin(
  page: Page,
  opts: { joinCode: string; name: string; pin: string },
) {
  await page.goto('/login/family')
  const codeInput = page.getByLabel(JOIN_CODE_LABEL)
  const avatar = page.getByRole('button', { name: opts.name })
  await expect(codeInput.or(avatar).first()).toBeVisible()
  if (await codeInput.isVisible()) {
    await codeInput.fill(opts.joinCode)
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  await avatar.click()
  await page.getByLabel('4-digit PIN').fill(opts.pin)
  await expect(page).toHaveURL('/')
}

test.describe('Self-service PIN', () => {
  test('a member changes their own PIN in Settings, then signs in with the new one', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => {
      // supabase-js realtime emits a transient non-Error rejection during rapid
      // auth churn (shows as "Object"); it's library-internal, not an app error.
      if (err.message === 'Object' || err.message === '[object Object]') return
      pageErrors.push(err.message)
    })

    const family = await createAdminFamily('e2e-selfpin')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    await setMemberPin(wife.memberId, '1111')
    const joinCode = await familyJoinCode(family.familyId)

    await signInWithPin(page, { joinCode, name: 'Wife', pin: '1111' })

    // Change the PIN from Settings (auto-submits at 4 digits).
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Change PIN' }).click()
    await page.getByLabel('New 4-digit PIN').fill('2222')
    await page.getByRole('button', { name: 'Save PIN' }).click()
    await expect(page.getByText('PIN updated.')).toBeVisible()

    // The old PIN no longer works; the new one does.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await signInWithPin(page, { joinCode, name: 'Wife', pin: '2222' })

    expect(pageErrors).toEqual([])
  })

  test('owner with only a PIN (no biometric) gets the PIN option on the email page', async ({
    page,
  }) => {
    const family = await createAdminFamily('e2e-pin-only')

    await page.goto('/login')
    await page.locator('#login-email').fill(family.adminEmail)
    await page.locator('#login-password').fill(family.adminPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Set a PIN' }).click()
    await page.getByLabel('New 4-digit PIN').fill('2468')
    await page.getByRole('button', { name: 'Save PIN' }).click()
    await expect(page.getByText('PIN set.')).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/login')

    // PIN is offered (device remembers the member); no fingerprint (never enrolled).
    const pinButton = page.getByRole('button', { name: 'PIN', exact: true })
    await expect(pinButton).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Unlock with Face ID or Touch ID' }),
    ).toHaveCount(0)

    await pinButton.click()
    await page.getByLabel('4-digit PIN').fill('2468')
    await expect(page).toHaveURL('/')
  })

  test('the account owner can set then remove their own PIN', async ({ page }) => {
    const family = await createAdminFamily('e2e-clearpin')

    await page.goto('/login')
    await page.locator('#login-email').fill(family.adminEmail)
    await page.locator('#login-password').fill(family.adminPassword)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Set a PIN' }).click()
    await page.getByLabel('New 4-digit PIN').fill('9876')
    await page.getByRole('button', { name: 'Save PIN' }).click()
    await expect(page.getByText('PIN set.')).toBeVisible()

    // Owner-only "Remove PIN" now shows; removing returns to "Set a PIN".
    await page.getByRole('button', { name: 'Remove PIN' }).click()
    await expect(page.getByText('PIN removed.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Set a PIN' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Remove PIN' }),
    ).toHaveCount(0)
  })
})
