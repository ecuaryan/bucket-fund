#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return 'ffmpeg'
  } catch {
    return require('@ffmpeg-installer/ffmpeg').path
  }
}

const ffmpegPath = resolveFfmpegPath()

/** @param {{ fps?: number; width?: number; trimStartSeconds?: number }} [options] */
export function webmToGif(webmPath, gifPath, options = {}) {
  const fps = options.fps ?? 10
  const width = options.width ?? 320
  const trimStartSeconds = options.trimStartSeconds ?? 0
  const tmp = mkdtempSync(join(tmpdir(), 'pwa-gif-'))
  const palette = join(tmp, 'palette.png')
  const inputArgs = trimStartSeconds > 0 ? ['-ss', String(trimStartSeconds)] : []

  try {
    execFileSync(
      ffmpegPath,
      [
        '-y',
        ...inputArgs,
        '-i',
        webmPath,
        '-vf',
        `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
        '-update',
        '1',
        palette,
      ],
      { stdio: 'pipe' },
    )
    execFileSync(
      ffmpegPath,
      [
        '-y',
        ...inputArgs,
        '-i',
        webmPath,
        '-i',
        palette,
        '-lavfi',
        `fps=${fps},scale=${width}:-1:flags=lanczos[p];[p][1:v]paletteuse=dither=bayer:bayer_scale=3`,
        gifPath,
      ],
      { stdio: 'pipe' },
    )
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

export function assertFfmpegInstalled() {
  try {
    execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore' })
  } catch {
    console.error('Could not run ffmpeg for PWA demo GIF export.')
    process.exit(1)
  }
}
