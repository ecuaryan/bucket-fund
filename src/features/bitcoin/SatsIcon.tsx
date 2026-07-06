/**
 * The community satoshi symbol (satsymbol.com): a vertical stroke through
 * three horizontal bars. Not in Unicode, so it's an inline SVG that follows
 * the surrounding text color.
 */
export default function SatsIcon({
  className = 'h-3 w-3',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <line x1="12" y1="1.5" x2="12" y2="4.5" />
      <line x1="5" y1="8" x2="19" y2="8" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="16" x2="19" y2="16" />
      <line x1="12" y1="19.5" x2="12" y2="22.5" />
    </svg>
  )
}
