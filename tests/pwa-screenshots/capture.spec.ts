import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { NAV_BUCKETS_LABEL, FLOAT_NEGATIVE_HINT } from '../../src/lib/brand'
import { SEED_PASSWORD, seedAdminEmail } from '../../scripts/seed/constants'
import { applyPwaScreenshotRebalance } from '../../scripts/seed/pwaScreenshotRebalance'
import {
  PWA_SCREENSHOT_ADMIN_DISPLAY_NAME,
  PWA_SCREENSHOT_BUCKETS,
  PWA_SCREENSHOT_SCENARIO_ID,
} from '../../scripts/seed/pwaScreenshots'

const outputDir = join(process.cwd(), 'public/screenshots')

/** Nav bubble re-measures in layout effect — wait until it centers on the active tab. */
async function waitForNavSettled(page: Page, label: string) {
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

test('capture PWA install screenshots', async ({ page }) => {
  await mkdir(outputDir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const adminEmail = seedAdminEmail(PWA_SCREENSHOT_SCENARIO_ID)

  await page.goto('/login')
  await page.locator('#login-email').fill(adminEmail)
  await page.locator('#login-password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await page.waitForURL('/')
  await page.getByText(PWA_SCREENSHOT_ADMIN_DISPLAY_NAME).waitFor()
  await page.getByRole('heading', { name: NAV_BUCKETS_LABEL }).waitFor()
  for (const bucket of PWA_SCREENSHOT_BUCKETS) {
    await page.getByText(bucket.name, { exact: true }).waitFor()
  }

  await page.screenshot({ path: join(outputDir, 'buckets.png') })

  await page.locator('nav').getByLabel('History').click()
  await expect(page).toHaveURL('/history')
  await waitForNavSettled(page, 'History')
  await page.getByRole('heading', { name: 'History' }).waitFor()
  await page.getByText(/\d+ transactions/).waitFor()
  await page.getByRole('main').getByText(/Bucket move/).first().waitFor()
  await page.screenshot({ path: join(outputDir, 'history.png') })

  await page.locator('nav').getByLabel('Send').click()
  await expect(page).toHaveURL('/send')
  await waitForNavSettled(page, 'Send')
  await page.getByRole('heading', { name: 'Send' }).waitFor()
  await page.getByText('You can send').waitFor()
  await page.locator('form').getByRole('button', { name: 'Send', exact: true }).waitFor()
  await page.screenshot({ path: join(outputDir, 'send.png') })

  await applyPwaScreenshotRebalance(adminEmail)
  await page.goto('/')
  await waitForNavSettled(page, 'Buckets')
  await page.getByText(FLOAT_NEGATIVE_HINT).waitFor()
  await page.screenshot({ path: join(outputDir, 'buckets-rebalance.png') })
})
