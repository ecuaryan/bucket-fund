#!/usr/bin/env node
/**
 * Build Android maskable PWA icons from the primary 512 asset.
 *
 * Maskable icons need an opaque full-bleed background and the logo inside the
 * center safe zone (max 80% diameter per spec; we use ~66% for launcher parity).
 * Run after changing brand icon art:
 *   npm install --no-save sharp && node scripts/generate-maskable-icons.mjs
 */
import { mkdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'public/icons/icon-512.png')
/** Logo scale within the canvas — below the 80% spec max for Material-style inset. */
const LOGO_SCALE = 0.66
const outputs = [
  { size: 512, file: 'icon-512-maskable.png' },
  { size: 192, file: 'icon-192-maskable.png' },
]

async function loadSharp() {
  try {
    return (await import('sharp')).default
  } catch {
    console.error(
      'sharp is required to generate maskable icons.\n' +
        'Run: npm install --no-save sharp && node scripts/generate-maskable-icons.mjs',
    )
    process.exit(1)
  }
}

async function generateMaskable(sharp, size, dest) {
  const safe = Math.round(size * LOGO_SCALE)
  const inset = Math.round((size - safe) / 2)
  const logo = await sharp(source)
    .resize(safe, safe, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: logo, top: inset, left: inset }])
    .removeAlpha()
    .png({ compressionLevel: 9, force: true })
    .toFile(dest)
}

await access(source)
const sharp = await loadSharp()
const outDir = join(root, 'public/icons')
await mkdir(outDir, { recursive: true })

for (const { size, file } of outputs) {
  const dest = join(outDir, file)
  await generateMaskable(sharp, size, dest)
  const safe = Math.round(size * LOGO_SCALE)
  console.log(`Wrote ${dest} (${size}x${size}, logo ${safe}px / ${LOGO_SCALE * 100}%)`)
}
