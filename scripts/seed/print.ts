import type { SeedAdmin, SeedMember } from './db'
import { SEED_PASSWORD, SEED_PIN } from './constants'

export type SeedResult = {
  scenario: string
  familyName: string
  admin: SeedAdmin
  joinCode: string
  members?: SeedMember[]
  pinMembers?: { name: string; pin: string }[]
  notes?: string[]
}

export function printSeedResult(result: SeedResult): void {
  const lines = [
    '',
    `── Seed: ${result.scenario} ──`,
    `Family: ${result.familyName}`,
    '',
    'Admin (email sign-in)',
    `  Email:    ${result.admin.adminEmail}`,
    `  Password: ${SEED_PASSWORD}`,
    '',
    `Join code: ${result.joinCode}`,
  ]

  if (result.members?.length) {
    lines.push('', 'Members:')
    for (const m of result.members) {
      lines.push(`  · ${m.name} (${m.role})`)
    }
  }

  if (result.pinMembers?.length) {
    lines.push('', 'PIN sign-in (family login → pick name → PIN):')
    for (const m of result.pinMembers) {
      lines.push(`  · ${m.name}: ${m.pin}`)
    }
  }

  if (result.notes?.length) {
    lines.push('', 'Notes:')
    for (const n of result.notes) {
      lines.push(`  · ${n}`)
    }
  }

  lines.push('')
  console.log(lines.join('\n'))
}

export function printSeedCredentialTable(results: SeedResult[]): void {
  const scenarioCol = 16
  const emailCol = 26

  const lines = [
    '',
    '── Seed credentials ──',
    `Password: ${SEED_PASSWORD} (every admin email below)`,
    `PIN: ${SEED_PIN} where listed — /login/family → join code → name → PIN`,
    '',
    `${'Scenario'.padEnd(scenarioCol)} ${'Admin email'.padEnd(emailCol)} Join code   PIN members`,
    `${'─'.repeat(scenarioCol)} ${'─'.repeat(emailCol)} ${'─'.repeat(10)} ${'─'.repeat(24)}`,
  ]

  for (const r of results) {
    const pins =
      r.pinMembers?.map((m) => `${m.name} ${m.pin}`).join(', ') ?? '—'
    lines.push(
      `${r.scenario.padEnd(scenarioCol)} ${r.admin.adminEmail.padEnd(emailCol)} ${r.joinCode.padEnd(11)} ${pins}`,
    )
  }

  lines.push(
    '',
    'Switch scenarios: sign out and sign in with another admin email — no reset needed.',
    '',
  )
  console.log(lines.join('\n'))
}
