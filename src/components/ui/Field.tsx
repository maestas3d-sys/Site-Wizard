import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

// 16px input text is deliberate, not just the brand spec — anything
// smaller makes iOS Safari zoom the viewport on focus.
const inputClasses =
  'w-full rounded border border-wr-taupe-200 bg-white px-3 text-base text-wr-ink-900 font-body placeholder:text-wr-ink-500 focus:border-wr-blue-800 focus:outline-none focus:ring-2 focus:ring-wr-blue-600/30'

interface FieldWrapperProps {
  label: string
  hint?: string
  children: ReactNode
}

function FieldWrapper({ label, hint, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-eyebrow text-sm font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-wr-ink-500">{hint}</span>}
    </label>
  )
}

type TextFieldProps = Omit<FieldWrapperProps, 'children'> & InputHTMLAttributes<HTMLInputElement>

export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint}>
      <input {...inputProps} className={`h-12 ${inputClasses}`} />
    </FieldWrapper>
  )
}

type TextAreaFieldProps = Omit<FieldWrapperProps, 'children'> &
  TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextAreaField({ label, hint, rows = 4, ...textareaProps }: TextAreaFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint}>
      <textarea rows={rows} {...textareaProps} className={`resize-none py-3 leading-normal ${inputClasses}`} />
    </FieldWrapper>
  )
}
