import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import PinInput from '@/components/ui/PinInput'
import { Sheet } from '@/components/ui/Sheet'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import { LoadingStatus } from '@/components/ui/LoadingStatus'
import {
  ADMIN_HOUSEHOLD_MEMBERS_DETAILS,
  ADMIN_HOUSEHOLD_MEMBERS_INTRO,
  ADMIN_HOUSEHOLD_MEMBERS_TITLE,
  ADMIN_LOADING_MEMBERS,
  APP_FORM_DATA_ATTR,
  REMOVE_CHILD_ACCOUNTS_DETAIL,
  adminPinSaveSuccess,
  adminPinSheetBody,
  adminPinSheetTitle,
} from '@/lib/brand'
import {
  ROLE_OPTION_ADULT,
  ROLE_OPTION_CHILD,
  roleLabel,
} from '@/lib/memberRoles'
import {
  clearPinLockout,
  createMember,
  removeMember,
  setMemberPin,
} from '@/lib/memberAuth'
type Member = {
  id: string
  name: string
  role: string
  avatar_url: string | null
  pin_locked: boolean
  pin_set_at: string | null
  pin_failed_attempts: number
  created_at: string
  family_id: string
  user_id: string | null
}

type MembersSectionProps = {
  /** Called when the family roster changes (add/remove) so siblings can refresh. */
  onRosterChanged?: () => void
}

export default function MembersSection({ onRosterChanged }: MembersSectionProps) {
  const auth = useAuth()
  const selfMemberId =
    auth.status === 'signedIn' ? auth.member?.id ?? null : null

  const [members, setMembers] = useState<Member[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'member' | 'child'>('member')
  const [creating, setCreating] = useState(false)

  const [pinTarget, setPinTarget] = useState<Member | null>(null)
  const [pinValue, setPinValue] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadMembers = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('family_members')
      .select(
        'id, name, role, avatar_url, pin_locked, pin_set_at, pin_failed_attempts, created_at, family_id, user_id',
      )
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message)
      return
    }
    setMembers(data ?? [])
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setActionError(null)
    setInfo(null)
    const familyId =
      auth.status === 'signedIn' ? auth.member?.family_id ?? '' : ''
    const tempId = `pending-${crypto.randomUUID()}`
    const optimistic: Member = {
      id: tempId,
      name,
      role: newRole,
      avatar_url: null,
      pin_locked: false,
      pin_set_at: null,
      pin_failed_attempts: 0,
      created_at: new Date().toISOString(),
      family_id: familyId,
      user_id: null,
    }
    setMembers((prev) => [...(prev ?? []), optimistic])
    setNewName('')
    setCreating(true)
    setRefreshing(true)
    try {
      const created = await createMember({ name, role: newRole })
      setMembers((prev) =>
        prev
          ? prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: created.id,
                    name: created.name,
                    role: created.role,
                  }
                : m,
            )
          : prev,
      )
      setInfo(`Added ${name}. Set their PIN next.`)
      await loadMembers()
      onRosterChanged?.()
    } catch (err) {
      setMembers((prev) => prev?.filter((m) => m.id !== tempId) ?? prev)
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
      setRefreshing(false)
    }
  }

  async function onSavePin(e: FormEvent) {
    e.preventDefault()
    if (!pinTarget) return
    if (!/^\d{4}$/.test(pinValue)) {
      setActionError('PIN must be exactly 4 digits.')
      return
    }
    setSavingPin(true)
    setActionError(null)
    setInfo(null)
    try {
      await setMemberPin(pinTarget.id, pinValue)
      setInfo(
        adminPinSaveSuccess(
          pinTarget.name,
          pinTarget.id === selfMemberId,
        ),
      )
      setPinTarget(null)
      setPinValue('')
      const pinNow = new Date().toISOString()
      setMembers((prev) =>
        prev
          ? prev.map((m) =>
              m.id === pinTarget.id
                ? {
                    ...m,
                    pin_set_at: pinNow,
                    pin_locked: false,
                    pin_failed_attempts: 0,
                  }
                : m,
            )
          : prev,
      )
      setRefreshing(true)
      try {
        await loadMembers()
      } finally {
        setRefreshing(false)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingPin(false)
    }
  }

  async function onRemove(m: Member) {
    if (m.role === 'admin') return
    const detail =
      m.role === 'child'
        ? REMOVE_CHILD_ACCOUNTS_DETAIL
        : 'They will lose access to the app. '
    const ok = window.confirm(
      `Remove ${m.name} from your household? ${detail}This cannot be undone.`,
    )
    if (!ok) return

    const snapshot = members
    setActionError(null)
    setInfo(null)
    if (pinTarget?.id === m.id) {
      setPinTarget(null)
      setPinValue('')
    }
    setMembers((prev) => (prev ? prev.filter((x) => x.id !== m.id) : prev))
    setRefreshing(true)
    try {
      await removeMember(m.id)
      setInfo(`Removed ${m.name}.`)
      await loadMembers()
      onRosterChanged?.()
    } catch (err) {
      setMembers(snapshot)
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function onClearLockout(m: Member) {
    setActionError(null)
    setInfo(null)
    try {
      await clearPinLockout(m.id)
      setInfo(`Lockout cleared for ${m.name}.`)
      setMembers((prev) =>
        prev
          ? prev.map((row) =>
              row.id === m.id
                ? { ...row, pin_locked: false, pin_failed_attempts: 0 }
                : row,
            )
          : prev,
      )
      setRefreshing(true)
      try {
        await loadMembers()
      } finally {
        setRefreshing(false)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  function startRename(m: Member) {
    setRenameValue(m.name)
    setRenamingId(m.id)
    setActionError(null)
    setInfo(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function commitRename(m: Member) {
    const next = renameValue.trim()
    if (!next || next === m.name) {
      cancelRename()
      return
    }
    setRenamingId(null)
    setRenameValue('')
    setActionError(null)
    setInfo(null)
    const snapshot = members
    setMembers((prev) =>
      prev
        ? prev.map((row) => (row.id === m.id ? { ...row, name: next } : row))
        : prev,
    )
    setRefreshing(true)
    try {
      const { error } = await supabase
        .from('family_members')
        .update({ name: next })
        .eq('id', m.id)
      if (error) throw error
      setInfo(`Renamed to ${next}.`)
      await loadMembers()
      onRosterChanged?.()
      if (m.id === selfMemberId) {
        await auth.refreshMember()
      }
    } catch (err) {
      setMembers(snapshot)
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const sectionBusy = creating || savingPin || refreshing

  return (
    <BusyOverlay busy={sectionBusy} label="Saving…">
    <section aria-label="Household members" className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{ADMIN_HOUSEHOLD_MEMBERS_TITLE}</h2>
        <p className="mt-1 text-xs text-zinc-400">
          {ADMIN_HOUSEHOLD_MEMBERS_INTRO}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
          {ADMIN_HOUSEHOLD_MEMBERS_DETAILS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {loadError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {loadError}
        </p>
      )}
      {actionError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {actionError}
        </p>
      )}
      {info && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
          {info}
        </p>
      )}

      <form
        onSubmit={onCreate}
        className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 sm:flex-row sm:items-end"
      >
        <label className="block flex-1">
          <span className="text-xs font-medium text-zinc-400">Name</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Jamie"
            className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700"
          />
        </label>
        <label className="block sm:w-52">
          <span className="text-xs font-medium text-zinc-400">Type</span>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'member' | 'child')}
            className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700"
          >
            <option value="member">{ROLE_OPTION_ADULT}</option>
            <option value="child">{ROLE_OPTION_CHILD}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {creating ? 'Adding…' : 'Add'}
        </button>
      </form>

      {members === null ? (
        <LoadingStatus label={ADMIN_LOADING_MEMBERS} className="py-6" />
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              {renamingId === m.id ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    aria-label={`Rename ${m.name}`}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(m)
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={() => void commitRename(m)}
                    className="min-w-0 flex-1 rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-emerald-400 focus:outline focus:outline-2 focus:outline-emerald-400"
                  />
                  <span className="shrink-0 text-xs font-normal text-zinc-500">
                    ({roleLabel(m.role)})
                  </span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {m.name}{' '}
                    <span className="text-xs font-normal text-zinc-500">
                      ({roleLabel(m.role)})
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {m.pin_set_at ? 'PIN set' : 'No PIN'}
                    {m.pin_locked ? ' · locked' : ''}
                    {m.pin_failed_attempts > 0 && !m.pin_locked
                      ? ` · ${m.pin_failed_attempts} failed attempt${m.pin_failed_attempts === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {renamingId !== m.id && (
                  <button
                    type="button"
                    onClick={() => startRename(m)}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    Edit
                  </button>
                )}
                {m.pin_locked && (
                  <button
                    type="button"
                    onClick={() => void onClearLockout(m)}
                    className="rounded-lg border border-amber-500/30 px-2 py-1 text-xs font-semibold text-amber-200"
                  >
                    Unlock
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPinTarget(m)
                    setPinValue('')
                    setActionError(null)
                  }}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  {m.pin_set_at ? 'Reset PIN' : 'Set PIN'}
                </button>
                {m.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => void onRemove(m)}
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pinTarget && (
        <Sheet
          open={pinTarget !== null}
          onClose={() => {
            setPinTarget(null)
            setPinValue('')
          }}
          aria-label={
            pinTarget.id === selfMemberId
              ? 'Set your PIN'
              : `Set PIN for ${pinTarget.name}`
          }
        >
          <form
            onSubmit={onSavePin}
            autoComplete="off"
            {...{ [APP_FORM_DATA_ATTR]: 'admin-set-pin' }}
          >
            <h3 id="pin-dialog-title" className="text-lg font-semibold text-zinc-300">
              {adminPinSheetTitle(pinTarget.name, pinTarget.id === selfMemberId)}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {adminPinSheetBody(pinTarget.name, pinTarget.id === selfMemberId)}
            </p>
            <PinInput
              autoFocus
              aria-label={`4-digit PIN for ${pinTarget.name}`}
              value={pinValue}
              onChange={setPinValue}
              className="mt-4 block w-full rounded-lg bg-zinc-950 px-3 py-3 text-center text-2xl tracking-[0.5em] text-zinc-300 ring-1 ring-zinc-700"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPinTarget(null)
                  setPinValue('')
                }}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPin || pinValue.length !== 4}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {savingPin ? 'Saving…' : 'Save PIN'}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </section>
    </BusyOverlay>
  )
}
