import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function FamilyJoinSection() {
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
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

  async function onRotate() {
    const ok = window.confirm(
      'Generate a new join code? Phones already linked keep working; only new devices need the new code.',
    )
    if (!ok) return
    setRotating(true)
    setInfo(null)
    setLoadError(null)
    try {
      const { data, error } = await supabase.rpc('rotate_family_join_code')
      if (error) throw error
      setJoinCode(data as string)
      setInfo('New join code created.')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
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
    <section aria-label="Family join code">
      <h2 className="text-base font-semibold">Family device code</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Scan or enter this once on each phone or tablet. After that,
        everyone signs in with their avatar and PIN.
      </p>

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
            alt="QR code to bind a device to this family"
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
              onClick={() => void onRotate()}
              disabled={rotating}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {rotating ? 'Rotating…' : 'New code'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
