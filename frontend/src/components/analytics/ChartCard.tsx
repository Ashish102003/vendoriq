import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function ChartCard({
  title,
  subtitle,
  action,
  className,
  children,
}: ChartCardProps) {
  return (
    <section
      className={cn(
        'iq-card-hover flex flex-col rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-6 py-6">{children}</div>
    </section>
  )
}