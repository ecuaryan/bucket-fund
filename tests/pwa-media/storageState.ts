import { writeFile } from 'node:fs/promises'
import type { BrowserContext, Page } from '@playwright/test'

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

/** Supabase auth uses sessionStorage — merge it into Playwright storage state. */
export async function buildStorageStateWithSession(
  context: BrowserContext,
  page: Page,
  origin: string,
): Promise<StorageState> {
  const sessionStorage = await page.evaluate(() => {
    const entries: { name: string; value: string }[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const name = sessionStorage.key(i)
      if (name) entries.push({ name, value: sessionStorage.getItem(name) ?? '' })
    }
    return entries
  })

  const state = await context.storageState()
  const normalizedOrigin = origin.replace(/\/$/, '')
  const originState = state.origins.find((o) => o.origin === normalizedOrigin)
  if (originState) {
    originState.sessionStorage = sessionStorage
  } else {
    state.origins.push({
      origin: normalizedOrigin,
      localStorage: [],
      sessionStorage,
    })
  }

  return state
}

export async function writeStorageStateWithSession(
  context: BrowserContext,
  page: Page,
  origin: string,
  path: string,
) {
  const state = await buildStorageStateWithSession(context, page, origin)
  await writeFile(path, JSON.stringify(state, null, 2))
}
