import { useEffect, useState, type FormEvent } from 'react'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { Sheet } from '@/components/ui/Sheet'
import {
  SIMPLEFIN_BRIDGE_LINK_LABEL,
  SIMPLEFIN_BRIDGE_URL,
  SIMPLEFIN_CONFIRM_EMPTY,
  SIMPLEFIN_CONFIRM_IMPORT_ACTION,
  SIMPLEFIN_CONFIRM_IMPORTING_LABEL,
  SIMPLEFIN_CONFIRM_KIND_CARD,
  SIMPLEFIN_CONFIRM_KIND_CASH,
  SIMPLEFIN_CONFIRM_SHEET_INTRO,
  SIMPLEFIN_CONFIRM_SHEET_TITLE,
  SIMPLEFIN_CONNECT_ACTION,
  SIMPLEFIN_CONNECTING_LABEL,
  SIMPLEFIN_CONNECT_SHEET_INTRO,
  SIMPLEFIN_CONNECT_SHEET_TITLE,
  SIMPLEFIN_TOKEN_FIELD_LABEL,
  SIMPLEFIN_TOKEN_INVALID_HINT,
  SIMPLEFIN_TOKEN_PLACEHOLDER,
} from '@/lib/brand'
import { formatErrorMessage } from '@/lib/errorMessage'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import {
  claimSimpleFinToken,
  confirmSimpleFinAccounts,
  discardSimpleFinConnection,
  type SimpleFinClaimResult,
  type SimpleFinConfirmedAccount,
} from '@/lib/simplefin'
import { isValidSetupToken, type NormalizedKind } from '@/lib/simplefinParse'

type Props = {
  open: boolean
  onClose: () => void
  onImported: (accounts: SimpleFinConfirmedAccount[]) => void | Promise<void>
}

type SelectionState = {
  included: boolean
  kind: NormalizedKind
}

/**
 * Two-step SimpleFIN connect flow: paste a one-time Setup Token (created on
 * the Bridge site, where the user pays SimpleFIN directly), then choose which
 * discovered accounts to import and classify each cash vs card — SimpleFIN
 * doesn't tell us account types.
 */
export default function SimpleFinConnectDialog({
  open,
  onClose,
  onImported,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claim, setClaim] = useState<SimpleFinClaimResult | null>(null)
  const [selections, setSelections] = useState<Map<string, SelectionState>>(
    new Map(),
  )

  useEffect(() => {
    if (!open) return
    setToken('')
    setBusy(false)
    setError(null)
    setClaim(null)
    setSelections(new Map())
  }, [open])

  const tokenValid = isValidSetupToken(token)
  const showTokenHint = token.trim().length > 0 && !tokenValid

  function close() {
    if (busy) return
    // A claimed connection with nothing imported is a stored credential
    // doing nothing — discard it server-side (best-effort; a leftover is
    // harmless and invisible, but tidy beats lingering).
    if (claim) {
      void discardSimpleFinConnection(claim.connectionId).catch(() => {})
    }
    onClose()
  }

  async function onSubmitToken(e: FormEvent) {
    e.preventDefault()
    if (!tokenValid || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await claimSimpleFinToken(token)
      setClaim(result)
      setSelections(
        new Map(
          result.accounts.map((a) => [
            a.id,
            { included: true, kind: a.suggestedKind },
          ]),
        ),
      )
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not connect. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  function setIncluded(accountId: string, included: boolean) {
    setSelections((prev) => {
      const next = new Map(prev)
      const current = next.get(accountId)
      if (current) next.set(accountId, { ...current, included })
      return next
    })
  }

  function setKind(accountId: string, kind: NormalizedKind) {
    setSelections((prev) => {
      const next = new Map(prev)
      const current = next.get(accountId)
      if (current) next.set(accountId, { ...current, kind })
      return next
    })
  }

  const includedCount = [...selections.values()].filter((s) => s.included).length

  async function onImport() {
    if (!claim || busy || includedCount === 0) return
    setBusy(true)
    setError(null)
    try {
      const picked = claim.accounts
        .filter((a) => selections.get(a.id)?.included)
        .map((a) => ({
          accountId: a.id,
          kind: selections.get(a.id)?.kind ?? a.suggestedKind,
        }))
      const imported = await confirmSimpleFinAccounts(claim.connectionId, picked)
      setClaim(null) // imported — nothing left to discard on close
      onClose()
      await onImported(imported)
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not import. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const title = claim ? SIMPLEFIN_CONFIRM_SHEET_TITLE : SIMPLEFIN_CONNECT_SHEET_TITLE

  return (
    <Sheet open={open} onClose={close} aria-label={title}>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
        <button
          type="button"
          onClick={close}
          disabled={busy}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      {!claim ? (
        <form onSubmit={(e) => void onSubmitToken(e)} className="space-y-4">
          <p className="text-sm text-zinc-400">{SIMPLEFIN_CONNECT_SHEET_INTRO}</p>
          <a
            href={SIMPLEFIN_BRIDGE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            {SIMPLEFIN_BRIDGE_LINK_LABEL} →
          </a>

          <label className="block">
            <FieldLabel spacing="tight">{SIMPLEFIN_TOKEN_FIELD_LABEL}</FieldLabel>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={SIMPLEFIN_TOKEN_PLACEHOLDER}
              rows={3}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100"
            />
            {showTokenHint ? (
              <p className="mt-1 text-xs text-amber-300/90">
                {SIMPLEFIN_TOKEN_INVALID_HINT}
              </p>
            ) : null}
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!tokenValid || busy}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? SIMPLEFIN_CONNECTING_LABEL : SIMPLEFIN_CONNECT_ACTION}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{SIMPLEFIN_CONFIRM_SHEET_INTRO}</p>

          {claim.errors.length > 0 ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
              {claim.errors.join(' ')}
            </p>
          ) : null}

          {claim.accounts.length === 0 ? (
            <p className="text-sm text-zinc-400">{SIMPLEFIN_CONFIRM_EMPTY}</p>
          ) : (
            <ul className="space-y-2">
              {claim.accounts.map((a) => {
                const selection = selections.get(a.id)
                const included = selection?.included ?? false
                const kind = selection?.kind ?? a.suggestedKind
                return (
                  <li
                    key={a.id}
                    className="rounded-xl bg-zinc-900 px-3 py-2.5 ring-1 ring-zinc-800"
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => setIncluded(a.id, e.target.checked)}
                        className="mt-1 h-4 w-4 accent-emerald-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-200">
                          {a.name}
                        </span>
                        <span className="block text-xs text-zinc-400">
                          {a.institutionName ?? '—'} ·{' '}
                          {formatMoney(Math.abs(a.balance))}
                        </span>
                      </span>
                    </label>
                    {included ? (
                      <div className="mt-2 flex gap-2 pl-7">
                        {(['cash', 'card'] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKind(a.id, k)}
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                              kind === k
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {k === 'cash'
                              ? SIMPLEFIN_CONFIRM_KIND_CASH
                              : SIMPLEFIN_CONFIRM_KIND_CARD}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="flex-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Cancel
            </button>
            {claim.accounts.length > 0 ? (
              <button
                type="button"
                onClick={() => void onImport()}
                disabled={busy || includedCount === 0}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? SIMPLEFIN_CONFIRM_IMPORTING_LABEL
                  : SIMPLEFIN_CONFIRM_IMPORT_ACTION}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Sheet>
  )
}
