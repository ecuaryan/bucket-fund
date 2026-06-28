import { useState } from 'react'
import { formatAppVersion } from '@/lib/appVersion'
import { applyAppUpdateNow } from '@/lib/pwaUpdate'
import { useAppUpdateReady } from '@/hooks/useAppUpdateReady'
import { APP_UPDATE_APPLYING_LABEL, APP_UPDATE_NOW_LABEL } from '@/lib/brand'
import { clearPerfLog, getPerfLog, perfEnabled } from '@/lib/perfTiming'

/** Build label for support — bottom of Settings and Admin tabs. */
export default function AppVersionFooter({ className = 'pt-6' }: { className?: string }) {
  const updateReady = useAppUpdateReady()
  const [applying, setApplying] = useState(false)

  return (
    <div className={`text-center ${className}`}>
      <p className="text-xs text-zinc-600">Version {formatAppVersion()}</p>
      {updateReady ? (
        <button
          type="button"
          onClick={() => {
            setApplying(true)
            applyAppUpdateNow()
          }}
          disabled={applying}
          className="mt-1 text-xs font-medium text-emerald-500 transition hover:text-emerald-400 disabled:opacity-60"
        >
          {applying ? APP_UPDATE_APPLYING_LABEL : APP_UPDATE_NOW_LABEL}
        </button>
      ) : null}
      <PerfReadout />
    </div>
  )
}

/** Debug-only login timing readout, shown after visiting the app with ?perf=1. */
function PerfReadout() {
  const [, force] = useState(0)
  if (!perfEnabled()) return null
  const log = getPerfLog()
  return (
    <div className="mx-auto mt-4 max-w-sm rounded-lg bg-zinc-900/80 p-3 text-left ring-1 ring-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-400">Login timing (debug)</p>
        <button
          type="button"
          onClick={() => {
            clearPerfLog()
            force((n) => n + 1)
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Clear
        </button>
      </div>
      {log.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-600">No timings yet — sign in once.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-500">
          {log.map((e, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate">{e.label}</span>
              <span
                className={
                  e.ms >= 1500
                    ? 'text-red-400'
                    : e.ms >= 600
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }
              >
                {e.ms}ms
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
