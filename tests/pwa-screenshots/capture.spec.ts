import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { NAV_BUCKETS_LABEL, FLOAT_NEGATIVE_HINT } from '../../src/lib/brand'
import { applyPwaScreenshotRebalance } from '../../scripts/seed/pwaScreenshotRebalance'
import { seedAdminEmail } from '../../scripts/seed/constants'
import {
  PWA_SCREENSHOT_BUCKETS,
  PWA_SCREENSHOT_SCENARIO_ID,
} from '../../scripts/seed/pwaScreenshots'
import {
  signInPwaScreenshotAdmin,
  waitForNavSettled,
} from '../pwa-media/helpers'

const outputDir = join(process.cwd(), 'public/screenshots')

test('capture PWA install screenshots', async ({ page }) => {
  await mkdir(outputDir, { recursive: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await signInPwaScreenshotAdmin(page)
  const adminEmail = seedAdminEmail(PWA_SCREENSHOT_SCENARIO_ID)
  const bucketsTab = page.getByRole('tab', { name: NAV_BUCKETS_LABEL })
  await expect(bucketsTab).toHaveAttribute('aria-selected', 'true')
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
  await waitForNavSettled(page, NAV_BUCKETS_LABEL)
  await expect(bucketsTab).toHaveAttribute('aria-selected', 'true')
  await page.getByText(FLOAT_NEGATIVE_HINT).waitFor()
  await page.screenshot({ path: join(outputDir, 'buckets-rebalance.png') })
})
