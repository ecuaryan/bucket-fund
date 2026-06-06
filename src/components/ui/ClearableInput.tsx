import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { INPUT_CLEAR_ARIA_LABEL } from '@/lib/brand'

/** Widen right padding only — keep px-* / pl-* so left inset stays intact. */
function withClearPadding(className: string): string {
  if (/\bpr-\S+\b/.test(className)) {
    return className.replace(/\bpr-\S+\b/, 'pr-9')
  }
  return `${className} pr-9`
}

export type ClearableInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
  inputClassName: string
  wrapperClassName?: string
  leading?: ReactNode
  clearAriaLabel?: string
  onClear?: () => void
}

export const ClearableInput = forwardRef<HTMLInputElement, ClearableInputProps>(
  function ClearableInput(
    {
      value,
      onValueChange,
      inputClassName,
      wrapperClassName,
      leading,
      clearAriaLabel = INPUT_CLEAR_ARIA_LABEL,
      onClear,
      disabled,
      ...rest
    },
    ref,
  ) {
    const showClear = value.length > 0 && !disabled

    return (
      <div className={wrapperClassName ? `relative ${wrapperClassName}` : 'relative'}>
        {leading}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          className={showClear ? withClearPadding(inputClassName) : inputClassName}
          {...rest}
        />
        {showClear ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onValueChange('')
              onClear?.()
            }}
            aria-label={clearAriaLabel}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        ) : null}
      </div>
    )
  },
)
