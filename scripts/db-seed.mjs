#!/usr/bin/env node
/**
 * Run a local seed scenario (or list scenarios when no arg).
 *
 *   npm run db:seed
 *   npm run db:seed -- household
 *   npm run db:reset:seed -- all
 *   npm run db:reset:seed -- pin-household
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scenario = process.argv[2]?.trim()
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const env = { ...process.env }
if (scenario) {
  env.SEED_SCENARIO = scenario
}

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vitest.seed.config.ts'],
  { cwd: root, env, stdio: 'inherit' },
)

process.exit(result.status ?? 1)
