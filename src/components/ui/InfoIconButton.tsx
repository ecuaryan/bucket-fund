type Props = {
  onClick: () => void
  /** Accessible name, e.g. "What is float?" */
  label: string
  className?: string
}

/** Minimal outline (i) for inline help — sized to read on hero cards without crowding the label. */
export default function InfoIconButton({ onClick, label, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 text-current opacity-45 transition hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ' +
        className
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="h-[1.125rem] w-[1.125rem]"
      >
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="8" cy="5.25" r="0.75" fill="currentColor" />
        <path
          d="M8 7.25V11"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
