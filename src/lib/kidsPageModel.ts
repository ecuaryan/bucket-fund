import type { ChildSetAsideLine } from '@/lib/availableBalance'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

export type KidMember = {
  id: string
  name: string
}

export type VirtualKidRow = {
  memberId: string
  name: string
  amount: number
  availableFloat: number
}

export type LinkedKidAccountRow = {
  id: string
  label: string
  balance: number
}

export type LinkedKidRow = {
  memberId: string
  name: string
  amount: number
  accounts: LinkedKidAccountRow[]
}

export function buildKidsPageModel(args: {
  children: KidMember[]
  childBalances: ChildSetAsideLine[]
  linkedChildIds: ReadonlySet<string>
  accounts: Account[]
}): { virtualKids: VirtualKidRow[]; linkedKids: LinkedKidRow[] } {
  const balanceById = new Map(
    args.childBalances.map((child) => [child.memberId, child]),
  )

  const virtualKids: VirtualKidRow[] = []
  const linkedKids: LinkedKidRow[] = []

  for (const child of args.children) {
    const balance = balanceById.get(child.id)
    const amount = balance?.amount ?? 0
    if (args.linkedChildIds.has(child.id)) {
      const ownedAccounts = args.accounts
        .filter((a) => a.owner_member_id === child.id)
        .map((a) => ({
          id: a.id,
          label: a.account_name ?? a.institution_name ?? 'Account',
          balance: Number(a.current_balance),
        }))
      linkedKids.push({
        memberId: child.id,
        name: child.name,
        amount,
        accounts: ownedAccounts,
      })
    } else {
      virtualKids.push({
        memberId: child.id,
        name: child.name,
        amount,
        availableFloat: balance?.availableFloat ?? 0,
      })
    }
  }

  virtualKids.sort((a, b) => a.name.localeCompare(b.name))
  linkedKids.sort((a, b) => a.name.localeCompare(b.name))

  return { virtualKids, linkedKids }
}
