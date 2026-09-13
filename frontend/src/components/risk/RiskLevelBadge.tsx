import { cn } from '../../utils/cn'
import { RISK_LEVEL_LABELS, RISK_LEVEL_STYLES } from '../../utils/risk'
import type { RiskLevel } from '../../types'

export function RiskLevelBadge({
  level,
  className,
}: {
  level: RiskLevel | null
  className?: string
}) {
  if (level === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-500/25 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-400',
          className,
        )}
      >
        No data
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        RISK_LEVEL_STYLES[level],
        className,
      )}
    >
      {RISK_LEVEL_LABELS[level]}
    </span>
  )
}