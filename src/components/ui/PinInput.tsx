import { useId, useState, type InputHTMLAttributes } from 'react'

type PinInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'autoComplete'
> & {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

/**
 * 4-digit PIN field that avoids `type="password"` so browsers do not treat
 * it as a site login password (save/update prompts). Masking uses CSS.
 */
export default function PinInput({
  value,
  onChange,
  maxLength = 4,
  className = '',
  autoFocus,
  id: idProp,
  ...rest
}: PinInputProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const [blockAutofill, setBlockAutofill] = useState(true)

  return (
    <input
      {...rest}
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={maxLength}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore
      data-form-type="other"
      name={`pin-${id}`}
      autoFocus={autoFocus}
      readOnly={blockAutofill}
      value={value}
      onFocus={() => setBlockAutofill(false)}
      onChange={(e) =>
        onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))
      }
      className={`pin-mask ${className}`.trim()}
    />
  )
}
