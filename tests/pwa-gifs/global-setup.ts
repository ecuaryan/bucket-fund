import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type FullConfig } from '@playwright/test'
import { PWA_SCREENSHOT_VIEWPORT } from '../../scripts/seed/pwaScreenshots'
import { signInPwaDemoGifAdmin } from '../pwa-media/helpers'
import { writeStorageStateWithSession } from '../pwa-media/storageState'

const authFile = join(process.cwd(), 'tmp/pwa-gifs/auth.json')

export default async function globalSetup(config: FullConfig) {
  await mkdir(join(process.cwd(), 'tmp/pwa-gifs'), { recursive: true })
  const baseURL =
    config.projects[0]?.use?.baseURL ?? 'http://127.0.0.1:5173'
  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL,
    viewport: PWA_SCREENSHOT_VIEWPORT,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await signInPwaDemoGifAdmin(page, baseURL)
  await writeStorageStateWithSession(context, page, baseURL, authFile)
  await browser.close()
}
