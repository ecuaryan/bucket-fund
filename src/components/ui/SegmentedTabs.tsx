import { nextSegmentedTabIndex } from '@/lib/segmentedTabsKeyboard'

type SegmentedTabsProps<T extends string> = {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedTabsProps<T>) {
  function focusTab(tabValue: T) {
    document.getElementById(`segmented-tab-${tabValue}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={
        'flex rounded-xl bg-zinc-900/80 p-1 ring-1 ring-zinc-800 ' + className
      }
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`segmented-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={`segmented-panel-${option.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const nextIndex = nextSegmentedTabIndex(
                event.key,
                index,
                options.length,
              )
              if (nextIndex === null) return
              event.preventDefault()
              const next = options[nextIndex]
              onChange(next.value)
              focusTab(next.value)
            }}
            className={
              'min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ' +
              (selected
                ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-zinc-700'
                : 'text-zinc-400 hover:text-zinc-300')
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
