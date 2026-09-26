import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="rounded border border-wr-taupe-200 bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-wr-blue-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-wr-ink-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
