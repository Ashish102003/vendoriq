import { riskScoreColor } from '../../utils/risk'

export function RiskScoreIndicator({
  score,
  label,
}: {
  score: number | null
  label?: string
}) {
  if (score === null) {
    return (
      <div>
        {label && (
          <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
        )}
        <div className="flex h-5 items-center text-xs text-slate-400">No data</div>
      </div>
    )
  }
  const color = riskScoreColor(score)
  return (
    <div>
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      )}
      <div className="flex items-center gap-2.5">
        <div className="relative h-2.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color }}
          />
        </div>
        <span className="min-w-[32px] text-sm font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  )
}