import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
