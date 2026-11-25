import type { ReactNode } from 'react'

export function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5 border-b border-line px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] font-semibold text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
