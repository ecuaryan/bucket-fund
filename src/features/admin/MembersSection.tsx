import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import PinInput from '@/components/ui/PinInput'
import {
  ADMIN_HOUSEHOLD_MEMBERS_INTRO,
  ADMIN_HOUSEHOLD_MEMBERS_TITLE,
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
  const [removingId, setRemovingId] = useState<string | null>(null)

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
    setCreating(true)
    setActionError(null)
    setInfo(null)
    try {
      await createMember({ name, role: newRole })
      setNewName('')
      setInfo(`Added ${name}. Set their PIN next.`)
      await loadMembers()
      onRosterChanged?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
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
      setInfo(`PIN updated for ${pinTarget.name}. They'll need to sign in again.`)
      setPinTarget(null)
      setPinValue('')
      await loadMembers()
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
        ? 'Their buckets will be deleted. Any bank accounts assigned to them will move to the shared pool. '
        : 'They will lose access to the app. '
    const ok = window.confirm(
      `Remove ${m.name} from your household? ${detail}This cannot be undone.`,
    )
    if (!ok) return

    setRemovingId(m.id)
    setActionError(null)
    setInfo(null)
    try {
      await removeMember(m.id)
      if (pinTarget?.id === m.id) {
        setPinTarget(null)
        setPinValue('')
      }
      setInfo(`Removed ${m.name}.`)
      await loadMembers()
      onRosterChanged?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemovingId(null)
    }
  }

  async function onClearLockout(m: Member) {
    setActionError(null)
    setInfo(null)
    try {
      await clearPinLockout(m.id)
      setInfo(`Lockout cleared for ${m.name}.`)
      await loadMembers()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section aria-label="Household members" className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{ADMIN_HOUSEHOLD_MEMBERS_TITLE}</h2>
        <p className="mt-1 text-xs text-zinc-400">
          {ADMIN_HOUSEHOLD_MEMBERS_INTRO} Tell each person their PIN in
          person—they cannot change it themselves.
        </p>
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
        <p className="text-sm text-zinc-400">Loading members…</p>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
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
              <div className="flex flex-wrap gap-2">
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
                    disabled={removingId === m.id}
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {removingId === m.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pinTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-dialog-title"
        >
          <form
            onSubmit={onSavePin}
            autoComplete="off"
            data-bucketfund-form="admin-set-pin"
            className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 ring-1 ring-zinc-800"
          >
            <h3 id="pin-dialog-title" className="text-lg font-semibold text-zinc-300">
              PIN for {pinTarget.name}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              4 digits. Saving signs them out everywhere until they sign in
              again.
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
        </div>
      )}
    </section>
  )
}
