import { useHideAmounts } from '@/lib/HideAmountsProvider'
import {
  HIDE_AMOUNTS_DETAIL,
  HIDE_AMOUNTS_LABEL,
  HIDE_AMOUNTS_OFF_STATUS,
  HIDE_AMOUNTS_ON_STATUS,
  HIDE_AMOUNTS_SECTION_TITLE,
  HIDE_AMOUNTS_SHOW_LABEL,
} from '@/lib/brand'

export default function DemoHideAmountsToggle() {
  const { hidden, setHidden } = useHideAmounts()

  return (
    <section
      className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800"
      aria-label={HIDE_AMOUNTS_SECTION_TITLE}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-300">
            {HIDE_AMOUNTS_SECTION_TITLE}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{HIDE_AMOUNTS_DETAIL}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hidden}
          onClick={() => setHidden(!hidden)}
          className={
            'relative h-7 w-12 shrink-0 rounded-full transition ' +
            (hidden ? 'bg-emerald-500' : 'bg-zinc-700')
          }
        >
          <span
            className={
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ' +
              (hidden ? 'translate-x-5' : 'translate-x-0')
            }
          />
          <span className="sr-only">
            {hidden ? HIDE_AMOUNTS_SHOW_LABEL : HIDE_AMOUNTS_LABEL}
          </span>
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {hidden ? HIDE_AMOUNTS_ON_STATUS : HIDE_AMOUNTS_OFF_STATUS}
      </p>
    </section>
  )
}
