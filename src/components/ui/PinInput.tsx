import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
} from 'react'

type PinInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'autoComplete' | 'ref'
> & {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

/**
 * 4-digit PIN field that avoids `type="password"` so browsers do not treat
 * it as a site login password (save/update prompts). Masking uses CSS.
 *
 * Do not use initial `readOnly` to block autofill — iOS Safari focuses the
 * field on first tap but refuses to show the keyboard until a second focus.
 */
const PinInput = forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  {
    value,
    onChange,
    maxLength = 4,
    className = '',
    autoFocus,
    id,
    ...rest
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement>(null)

  const setRef = (el: HTMLInputElement | null) => {
    localRef.current = el
    if (typeof forwardedRef === 'function') {
      forwardedRef(el)
    } else if (forwardedRef) {
      forwardedRef.current = el
    }
  }

  useLayoutEffect(() => {
    if (!autoFocus) return
    const el = localRef.current
    if (!el) return
    el.focus({ preventScroll: true })
  }, [autoFocus])

  return (
    <input
      {...rest}
      ref={setRef}
      id={id}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      maxLength={maxLength}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore
      data-form-type="other"
      name={id ? `pin-${id}` : undefined}
      value={value}
      onChange={(e) =>
        onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))
      }
      className={`pin-mask ${className}`.trim()}
    />
  )
})

export default PinInput
