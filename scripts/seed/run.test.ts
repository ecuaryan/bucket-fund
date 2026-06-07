import { describe, expect, it } from 'vitest'
import { seedAdminEmail } from './constants'
import {
  isSeedTarget,
  listScenarios,
  SCENARIO_IDS,
  SEED_ALL,
  seedAllScenarios,
  seedScenario,
} from './scenarios'
import { printSeedCredentialTable, printSeedResult } from './print'

describe('local db seed', () => {
  it('lists scenarios when SEED_SCENARIO is unset', () => {
    const scenario = process.env.SEED_SCENARIO?.trim()
    if (scenario) return

    console.log('\nUsage: SEED_SCENARIO=<id> npm run db:seed\n')
    for (const row of listScenarios()) {
      console.log(`  ${row.id.padEnd(14)} ${row.description}`)
    }
    console.log('\nExample: npm run db:reset:seed -- all\n')
    expect(listScenarios().length).toBeGreaterThan(0)
  })

  it('seeds the requested scenario', async () => {
    const scenario = process.env.SEED_SCENARIO?.trim()
    if (!scenario) return

    expect(
      isSeedTarget(scenario),
      `Unknown SEED_SCENARIO "${scenario}". Run npm run db:seed for the list.`,
    ).toBe(true)

    if (scenario === SEED_ALL) {
      const results = await seedAllScenarios()
      expect(results).toHaveLength(SCENARIO_IDS.length)
      for (const result of results) {
        expect(result.admin.adminEmail).toBe(seedAdminEmail(result.scenario))
      }
      printSeedCredentialTable(results)
      return
    }

    const result = await seedScenario(scenario)
    printSeedResult(result)
    expect(result.admin.adminEmail).toBe(seedAdminEmail(scenario))
  }, 180_000)
})
