import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white active:bg-blue-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 active:bg-slate-100',
  danger: 'bg-white text-red-600 border border-red-300 active:bg-red-50',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Minimum 48px tall, per the field-constraint rule of thumb — even office screens stay one design language. */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 rounded-lg px-4 py-3 text-base font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    />
  )
}
