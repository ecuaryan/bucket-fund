import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HTML_META_DESCRIPTION, OFFLINE_PAGE_BODY } from './brand'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('static HTML copy stays in sync with brand.ts', () => {
  it('index.html meta description', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain(`content="${HTML_META_DESCRIPTION}"`)
  })

  it('offline.html body paragraph', () => {
    const html = readFileSync(join(root, 'public/offline.html'), 'utf8')
    expect(html).toContain(OFFLINE_PAGE_BODY)
  })
})
