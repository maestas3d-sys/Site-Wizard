import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-wr-blue-800 text-white active:bg-wr-blue-900',
  secondary: 'bg-white text-wr-blue-800 border border-wr-blue-800 active:bg-wr-blue-50',
  danger: 'bg-white text-wr-danger border border-wr-danger active:bg-red-50',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Minimum 48px tall (52px for primary bottom-bar actions, set by the
 * caller) — the field-constraint rule of thumb, even for office screens.
 * A disabled button just dims per the brand spec, no extra affordance. */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 rounded px-4 py-3 font-body text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    />
  )
}
