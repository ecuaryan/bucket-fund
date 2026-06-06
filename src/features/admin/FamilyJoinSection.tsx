import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import {
  ADMIN_JOIN_CODE_INTRO,
  ADMIN_JOIN_CODE_QR_ALT,
  ADMIN_JOIN_CODE_ROTATE_CONFIRM,
  ADMIN_JOIN_CODE_ROTATE_EFFECT_OLD_LINKS,
  ADMIN_JOIN_CODE_ROTATE_EFFECT_SHARE,
  ADMIN_JOIN_CODE_ROTATE_EFFECT_SIGN_IN_AGAIN,
  ADMIN_JOIN_CODE_ROTATE_EFFECT_STAY_SIGNED_IN,
  ADMIN_JOIN_CODE_ROTATE_SHEET_INTRO,
  ADMIN_JOIN_CODE_ROTATE_SHEET_TITLE,
  ADMIN_JOIN_CODE_ROTATE_SUCCESS,
  ADMIN_JOIN_CODE_ROTATE_WHAT_HAPPENS,
  ADMIN_JOIN_CODE_TITLE,
} from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export default function FamilyJoinSection() {
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rotateError, setRotateError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadCode = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('families')
      .select('join_code')
      .maybeSingle()
    if (error) {
      setLoadError(error.message)
      return
    }
    setJoinCode(data?.join_code ?? null)
  }, [])

  useEffect(() => {
    void loadCode()
  }, [loadCode])

  const joinUrl = useMemo(() => {
    if (!joinCode || typeof window === 'undefined') return ''
    return `${window.location.origin}/join?code=${encodeURIComponent(joinCode)}`
  }, [joinCode])

  const qrSrc = useMemo(() => {
    if (!joinUrl) return ''
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`
  }, [joinUrl])

  function openRotateConfirm() {
    setRotateError(null)
    setConfirmOpen(true)
  }

  function closeRotateConfirm() {
    if (rotating) return
    setConfirmOpen(false)
    setRotateError(null)
  }

  async function confirmRotate() {
    setRotating(true)
    setRotateError(null)
    setLoadError(null)
    try {
      const { data, error } = await supabase.rpc('rotate_family_join_code')
      if (error) throw error
      setJoinCode(data as string)
      setInfo(ADMIN_JOIN_CODE_ROTATE_SUCCESS)
      setConfirmOpen(false)
    } catch (e) {
      setRotateError(e instanceof Error ? e.message : String(e))
    } finally {
      setRotating(false)
    }
  }

  async function onCopy() {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setLoadError('Could not copy to clipboard')
    }
  }

  return (
    <section aria-label="Household join code">
      <h2 className="text-base font-semibold">{ADMIN_JOIN_CODE_TITLE}</h2>
      <p className="mt-1 text-xs text-zinc-400">{ADMIN_JOIN_CODE_INTRO}</p>

      {loadError && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
          {loadError}
        </p>
      )}
      {info && (
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
          {info}
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 sm:flex-row sm:items-start">
        {qrSrc && (
          <img
            src={qrSrc}
            alt={ADMIN_JOIN_CODE_QR_ALT}
            width={180}
            height={180}
            className="rounded-lg bg-white p-2"
          />
        )}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-mono text-2xl font-semibold tracking-widest text-zinc-300">
            {joinCode ?? '…'}
          </p>
          <p className="mt-2 break-all text-xs text-zinc-500">{joinUrl}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => void onCopy()}
              disabled={!joinUrl}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={openRotateConfirm}
              disabled={rotating}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              New code
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={confirmOpen}
        onClose={closeRotateConfirm}
        aria-label={ADMIN_JOIN_CODE_ROTATE_SHEET_TITLE}
      >
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-300">
            {ADMIN_JOIN_CODE_ROTATE_SHEET_TITLE}
          </h2>
          <button
            type="button"
            onClick={closeRotateConfirm}
            disabled={rotating}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {ADMIN_JOIN_CODE_ROTATE_SHEET_INTRO}
          </p>

          <div>
            <h3 className="text-sm font-medium text-zinc-300">
              {ADMIN_JOIN_CODE_ROTATE_WHAT_HAPPENS}
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-400">
              <li>{ADMIN_JOIN_CODE_ROTATE_EFFECT_STAY_SIGNED_IN}</li>
              <li>{ADMIN_JOIN_CODE_ROTATE_EFFECT_SIGN_IN_AGAIN}</li>
              <li>{ADMIN_JOIN_CODE_ROTATE_EFFECT_OLD_LINKS}</li>
              <li>{ADMIN_JOIN_CODE_ROTATE_EFFECT_SHARE}</li>
            </ul>
          </div>

          {rotateError ? (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
            >
              {rotateError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closeRotateConfirm}
              disabled={rotating}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmRotate()}
              disabled={rotating}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
            >
              {rotating ? 'Generating…' : ADMIN_JOIN_CODE_ROTATE_CONFIRM}
            </button>
          </div>
        </div>
      </Sheet>
    </section>
  )
}
