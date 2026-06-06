#!/usr/bin/env node
/**
 * Vite dev server reachable from other devices on the same WiFi.
 *
 * Overrides VITE_SUPABASE_URL to the Mac's LAN IP so the phone browser
 * can reach local Supabase (:54321). Other vars still come from .env.local.
 *
 *   npm run dev:phone
 */
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SUPABASE_PORT = 54321
const VITE_PORT = 5173

/** @returns {string | null} */
export function pickLanIPv4() {
  const nets = networkInterfaces()
  const prefer = ['en0', 'en1', 'wlan0', 'eth0']
  for (const name of prefer) {
    const ip = firstExternalIPv4(nets[name])
    if (ip) return ip
  }
  for (const addrs of Object.values(nets)) {
    const ip = firstExternalIPv4(addrs)
    if (ip) return ip
  }
  return null
}

/** @param {import('node:os').NetworkInterfaceInfo[] | undefined} addrs */
function firstExternalIPv4(addrs) {
  if (!addrs) return null
  for (const a of addrs) {
    if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return null
}

function main() {
  const ip = pickLanIPv4()
  if (!ip) {
    console.error(
      'Could not detect a LAN IPv4 address. Connect to WiFi, or run: npm run dev',
    )
    process.exit(1)
  }

  const supabaseUrl = `http://${ip}:${SUPABASE_PORT}`
  const phoneUrl = `http://${ip}:${VITE_PORT}`

  console.log('')
  console.log('Phone (same WiFi):', phoneUrl)
  console.log('Desktop:', `http://localhost:${VITE_PORT}`)
  console.log('Supabase API (for this session):', supabaseUrl)
  console.log('')

  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

  const child = spawn(
    process.execPath,
    [viteBin, '--host', '0.0.0.0', '--port', String(VITE_PORT)],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
      },
    },
  )

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 0)
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
