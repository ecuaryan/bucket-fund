type Props = {
  className?: string
}

/** 3×3 keypad dots — represents a numeric PIN entry. */
export default function KeypadIcon({ className = 'h-5 w-5' }: Props) {
  const cols = [6, 12, 18]
  const rows = [6, 12, 18]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {rows.map((cy) =>
        cols.map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.7} />),
      )}
    </svg>
  )
}
