import { expect, type Page } from '@playwright/test'
import {
  NAV_BUCKETS_LABEL,
  ONBOARDING_COACH_DISMISS_LABEL,
  ONBOARDING_COACH_TITLE,
} from '../../src/lib/brand'
import { SEED_PASSWORD, seedAdminEmail } from '../../scripts/seed/constants'
import {
  PWA_DEMO_GIF_ADMIN_DISPLAY_NAME,
  PWA_DEMO_GIF_SCENARIO_ID,
} from '../../scripts/seed/pwaDemoGifs'
import {
  PWA_SCREENSHOT_ADMIN_DISPLAY_NAME,
  PWA_SCREENSHOT_SCENARIO_ID,
} from '../../scripts/seed/pwaScreenshots'

/** Pause after a major step so viewers can read the screen. */
export const DEMO_HOLD_MS = 1500

/** Short pause between related actions. */
export const DEMO_STEP_MS = 550

/** Let drag / FLIP animations finish before the next action. */
export const DEMO_ANIMATION_MS = 450

/** Nav bubble re-measures in layout effect — wait until it centers on the active tab. */
export async function waitForNavSettled(page: Page, label: string) {
  const tab = page.locator('nav').getByLabel(label)
  await expect(tab).toHaveClass(/text-emerald-300/)
  await page.waitForFunction((tabLabel) => {
    const link = Array.from(document.querySelectorAll('nav a')).find(
      (a) => a.getAttribute('aria-label') === tabLabel,
    )
    const bubble = document.querySelector('nav ul > div[aria-hidden]')
    if (!link || !bubble) return false
    const linkRect = link.getBoundingClientRect()
    const bubbleRect = bubble.getBoundingClientRect()
    const linkCenter = linkRect.left + linkRect.width / 2
    const bubbleCenter = bubbleRect.left + bubbleRect.width / 2
    return Math.abs(linkCenter - bubbleCenter) < 2
  }, label)
}

export async function signInSeedAdmin(
  page: Page,
  scenarioId: string,
  options?: { baseURL?: string; waitForName?: string },
) {
  const adminEmail = seedAdminEmail(scenarioId)
  const loginPath = options?.baseURL
    ? `${options.baseURL.replace(/\/$/, '')}/login`
    : '/login'
  await page.goto(loginPath)
  await page.locator('#login-email').fill(adminEmail)
  await page.locator('#login-password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('tab', { name: NAV_BUCKETS_LABEL }).waitFor()
  const waitForName =
    options?.waitForName ??
    (scenarioId === PWA_DEMO_GIF_SCENARIO_ID
      ? PWA_DEMO_GIF_ADMIN_DISPLAY_NAME
      : scenarioId === PWA_SCREENSHOT_SCENARIO_ID
        ? PWA_SCREENSHOT_ADMIN_DISPLAY_NAME
        : null)
  if (waitForName) {
    await page.getByText(waitForName).waitFor()
  }
}

export async function signInPwaScreenshotAdmin(page: Page) {
  await signInSeedAdmin(page, PWA_SCREENSHOT_SCENARIO_ID)
}

export async function signInPwaDemoGifAdmin(
  page: Page,
  baseURL?: string,
) {
  await signInSeedAdmin(page, PWA_DEMO_GIF_SCENARIO_ID, { baseURL })
}

export async function demoPause(page: Page, ms: number) {
  await page.waitForTimeout(ms)
}

export async function dismissOnboardingCoachIfVisible(page: Page) {
  const coach = page.getByRole('region', { name: ONBOARDING_COACH_TITLE })
  if (await coach.isVisible().catch(() => false)) {
    await coach
      .getByRole('button', { name: ONBOARDING_COACH_DISMISS_LABEL, exact: true })
      .click()
    await expect(coach).not.toBeVisible()
    await demoPause(page, DEMO_STEP_MS)
  }
}

export function bucketListItem(page: Page, bucketName: string) {
  return page.getByRole('listitem').filter({ hasText: bucketName })
}

export async function createBucketInUi(page: Page, name: string) {
  const existing = bucketListItem(page, name)
  if (await existing.isVisible().catch(() => false)) {
    return
  }
  const input = page.getByPlaceholder('New bucket name')
  await input.fill(name)
  await demoPause(page, DEMO_STEP_MS)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await bucketListItem(page, name).waitFor()
  await demoPause(page, DEMO_HOLD_MS)
}

export async function setAsideFromFloat(
  page: Page,
  bucketName: string,
  amount: number,
) {
  const row = bucketListItem(page, bucketName)
  const balance = row.getByRole('button', { name: new RegExp(`${bucketName} \\$`) })
  const balanceText = await balance.textContent()
  if (balanceText && !balanceText.includes('$0')) {
    return
  }
  await row.locator('[data-reorder-row]').click()
  await page.getByLabel('Amount').waitFor()
  await demoPause(page, DEMO_STEP_MS)
  await page.getByLabel('Amount').fill(String(amount))
  await demoPause(page, DEMO_STEP_MS)
  await page.getByRole('button', { name: /^Set aside/ }).click()
  await expect(page.getByLabel('Amount')).not.toBeVisible()
  await demoPause(page, DEMO_HOLD_MS)
}

export async function moveBucketUp(page: Page, bucketName: string) {
  const row = bucketListItem(page, bucketName)
  await row.getByRole('button', { name: 'Bucket options' }).click()
  await page.getByRole('menuitem', { name: 'Move up' }).click()
  await demoPause(page, DEMO_HOLD_MS)
}

/** Drag a bucket up one slot using the grip — shows live reorder animation. */
export async function dragBucketUp(page: Page, bucketName: string) {
  const items = page.getByRole('listitem')
  const count = await items.count()
  let index = -1
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).textContent()
    if (text?.includes(bucketName)) {
      index = i
      break
    }
  }
  if (index <= 0) return

  const sourceRow = items.nth(index)
  const targetRow = items.nth(index - 1)
  const grip = sourceRow.getByRole('button', { name: 'Reorder bucket' })
  const gripBox = await grip.boundingBox()
  const targetBox = await targetRow.boundingBox()
  if (!gripBox || !targetBox) {
    throw new Error(`Could not measure bucket rows for drag reorder (${bucketName}).`)
  }

  await demoPause(page, DEMO_STEP_MS)

  const startX = gripBox.x + gripBox.width / 2
  const startY = gripBox.y + gripBox.height / 2
  const endX = startX
  const endY = targetBox.y + targetBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - 12, { steps: 4 })
  await demoPause(page, DEMO_ANIMATION_MS)
  await page.mouse.move(endX, endY, { steps: 18 })
  await demoPause(page, DEMO_ANIMATION_MS)
  await page.mouse.up()
  await demoPause(page, DEMO_HOLD_MS)
}
