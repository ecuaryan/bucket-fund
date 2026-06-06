import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { FieldLabel } from '@/components/ui/FieldLabel'
import {
  ADMIN_ASSIGN_ACCOUNT_TO_KID_EFFECTS,
  ADMIN_ASSIGN_ACCOUNT_TO_KID_WHAT_CHANGES,
  adminAssignAccountToKidConfirm,
  adminAssignAccountToKidSheetIntro,
  adminAssignAccountToKidSheetTitle,
  HOUSEHOLD_LABEL,
} from '@/lib/brand'
import { assignAccountOwner } from '@/lib/accounts'

export type ChildMemberOption = {
  id: string
  name: string
}

type PendingKidAssign = {
  kidId: string
  kidName: string
}

type AccountAssignmentSelectProps = {
  accountId: string
  /** null = household (shared balance); otherwise a kid member id. */
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
  const [pendingKid, setPendingKid] = useState<PendingKidAssign | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function applyAssign(ownerMemberId: string | null) {
    setSaving(true)
    try {
      await assignAccountOwner(accountId, ownerMemberId)
      onAssigned(ownerMemberId)
      setPendingKid(null)
      setConfirmError(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (ownerMemberId === null) {
        onError(message)
      } else {
        setConfirmError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  function onSelectChange(nextChildId: string) {
    const ownerMemberId = nextChildId === '' ? null : nextChildId
    if (ownerMemberId === assignedChildId) return

    if (ownerMemberId === null) {
      void applyAssign(null)
      return
    }

    const kid = children.find((c) => c.id === ownerMemberId)
    if (!kid) return

    setConfirmError(null)
    setPendingKid({ kidId: kid.id, kidName: kid.name })
  }

  function closeKidConfirm() {
    if (saving) return
    setPendingKid(null)
    setConfirmError(null)
  }

  async function confirmKidAssign() {
    if (!pendingKid) return
    await applyAssign(pendingKid.kidId)
  }

  if (children.length === 0) {
    return (
      <span className="text-xs text-zinc-500">
        {assignedChildId ? 'Assigned' : HOUSEHOLD_LABEL}
      </span>
    )
  }

  return (
    <>
      <label className="flex shrink-0 flex-col items-end gap-0.5">
        <FieldLabel spacing="tight" compact>
          Assigned to
        </FieldLabel>
        <select
          value={assignedChildId ?? ''}
          disabled={saving}
          onChange={(e) => onSelectChange(e.target.value)}
          className="max-w-[9rem] rounded-lg border-0 bg-zinc-950 py-1.5 pl-2 pr-7 text-xs text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400 disabled:opacity-50"
          aria-label={`Assign account to ${HOUSEHOLD_LABEL.toLowerCase()} or kid`}
        >
          <option value="">{HOUSEHOLD_LABEL}</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {pendingKid ? (
        <Sheet
          open
          onClose={closeKidConfirm}
          aria-label={adminAssignAccountToKidSheetTitle(pendingKid.kidName)}
        >
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-300">
              {adminAssignAccountToKidSheetTitle(pendingKid.kidName)}
            </h2>
            <button
              type="button"
              onClick={closeKidConfirm}
              disabled={saving}
              className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              {adminAssignAccountToKidSheetIntro(pendingKid.kidName)}
            </p>

            <div>
              <h3 className="text-sm font-medium text-zinc-300">
                {ADMIN_ASSIGN_ACCOUNT_TO_KID_WHAT_CHANGES}
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-400">
                {ADMIN_ASSIGN_ACCOUNT_TO_KID_EFFECTS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {confirmError ? (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
              >
                {confirmError}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeKidConfirm}
                disabled={saving}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmKidAssign()}
                disabled={saving}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                {saving
                  ? 'Assigning…'
                  : adminAssignAccountToKidConfirm(pendingKid.kidName)}
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  )
}
