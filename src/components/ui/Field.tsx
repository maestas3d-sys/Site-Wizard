import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

const inputClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200'

interface FieldWrapperProps {
  label: string
  hint?: string
  children: ReactNode
}

function FieldWrapper({ label, hint, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

type TextFieldProps = Omit<FieldWrapperProps, 'children'> & InputHTMLAttributes<HTMLInputElement>

export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint}>
      <input {...inputProps} className={inputClasses} />
    </FieldWrapper>
  )
}

type TextAreaFieldProps = Omit<FieldWrapperProps, 'children'> &
  TextareaHTMLAttributes<HTMLTextAreaElement>

export function TextAreaField({ label, hint, ...textareaProps }: TextAreaFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint}>
      <textarea {...textareaProps} className={`${inputClasses} min-h-24`} />
    </FieldWrapper>
  )
}
