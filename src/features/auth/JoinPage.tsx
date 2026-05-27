import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { bindFamily } from '@/lib/familyDevice'
import { validateJoinCode } from '@/lib/memberAuth'

export default function JoinPage() {
  const [params] = useSearchParams()
  const codeFromUrl = params.get('code')?.trim() ?? ''
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!codeFromUrl) return
    let cancelled = false

    void (async () => {
      try {
        const result = await validateJoinCode(codeFromUrl)
        if (cancelled) return
        bindFamily(result.familyId, codeFromUrl)
        setDone(true)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Invalid join code')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [codeFromUrl])

  if (done) {
    return <Navigate to="/login/family" replace />
  }

  if (!codeFromUrl) {
    return (
      <AuthShell>
        <p className="text-sm text-zinc-400">
          Missing join code. Scan your family QR or enter the code on the{' '}
          <Link to="/login/family" className="text-emerald-400 hover:underline">
            family sign-in
          </Link>{' '}
          page.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {error ? (
        <>
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
            {error}
          </p>
          <Link
            to="/login/family"
            className="mt-4 block text-center text-sm text-emerald-400 hover:underline"
          >
            Enter code manually
          </Link>
        </>
      ) : (
        <p className="text-sm text-zinc-400">Linking this device to your family…</p>
      )}
    </AuthShell>
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  )
}
