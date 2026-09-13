import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  accent?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red' | 'sky' | 'orange' | 'teal'
  hint?: string
  className?: string
}

const ACCENTS = {
  slate: 'text-slate-400 border-slate-700/60 bg-slate-800/50',
  indigo: 'text-indigo-300 border-indigo-500/25 bg-indigo-500/10',
  emerald: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10',
  teal: 'text-teal-300 border-teal-500/25 bg-teal-500/10',
  amber: 'text-amber-300 border-amber-500/25 bg-amber-500/10',
  red: 'text-red-300 border-red-500/25 bg-red-500/10',
  sky: 'text-sky-300 border-sky-500/25 bg-sky-500/10',
  orange: 'text-orange-300 border-orange-500/25 bg-orange-500/10',
} as const

/**
 * KPI metric card: dark surface, small label, large readable value, optional
 * context line and a small icon chip. Light and consistent across pages.
 */
export function StatCard({
  label,
  value,
  icon,
  accent = 'indigo',
  hint,
  className,
}: StatCardProps) {
  return (
    <div className={cn(cardClass, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-[1.65rem] leading-none font-semibold tabular-nums text-slate-100">
            {value}
          </p>
          {hint && <p className="mt-2 truncate text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              ACCENTS[accent],
            )}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  )
}

export const cardClass =
  'iq-card-hover rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] px-6 py-5'