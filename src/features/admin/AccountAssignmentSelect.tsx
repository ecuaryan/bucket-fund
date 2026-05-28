import { useState } from 'react'
import { assignAccountOwner } from '@/lib/accounts'

export type ChildMemberOption = {
  id: string
  name: string
}

type AccountAssignmentSelectProps = {
  accountId: string
  /** null = family pool; otherwise a child member id. */
  assignedChildId: string | null
  children: ChildMemberOption[]
  onAssigned: (ownerMemberId: string | null) => void
  onError: (message: string) => void
}

export default function AccountAssignmentSelect({
  accountId,
  assignedChildId,
  children,
  onAssigned,
  onError,
}: AccountAssignmentSelectProps) {
  const [saving, setSaving] = useState(false)

  async function onChange(nextChildId: string) {
    const ownerMemberId = nextChildId === '' ? null : nextChildId
    if (ownerMemberId === assignedChildId) return

    setSaving(true)
    try {
      await assignAccountOwner(accountId, ownerMemberId)
      onAssigned(ownerMemberId)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (children.length === 0) {
    return (
      <span className="text-xs text-zinc-500">
        {assignedChildId ? 'Assigned' : 'Family'}
      </span>
    )
  }

  return (
    <label className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Assigned to
      </span>
      <select
        value={assignedChildId ?? ''}
        disabled={saving}
        onChange={(e) => void onChange(e.target.value)}
        className="max-w-[9rem] rounded-lg border-0 bg-zinc-950 py-1.5 pl-2 pr-7 text-xs text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400 disabled:opacity-50"
        aria-label="Assign account to family or child"
      >
        <option value="">Family</option>
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
