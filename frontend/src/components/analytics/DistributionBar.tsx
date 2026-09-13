import { CLASSIFICATION_COLORS } from './chartTheme'
import { PERFORMANCE_CLASSIFICATION_LABELS } from '../../utils/permissions'
import type { VendorPerformanceClassification } from '../../types'

interface DistributionBarProps {
  items: {
    classification: VendorPerformanceClassification
    count: number
    percentage: number
  }[]
  totalVendors: number
}

export function DistributionBar({ items, totalVendors }: DistributionBarProps) {
  const segments = items.map((item) => ({
    ...item,
    color: CLASSIFICATION_COLORS[item.classification],
  }))

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-800/70">
        {segments.map(
          (segment) =>
            segment.count > 0 && (
              <div
                key={segment.classification}
                title={`${PERFORMANCE_CLASSIFICATION_LABELS[segment.classification]}: ${segment.count}`}
                className="h-full"
                style={{
                  width: `${segment.percentage}%`,
                  backgroundColor: segment.color,
                }}
              />
            ),
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.classification} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-xs text-slate-400">
              {PERFORMANCE_CLASSIFICATION_LABELS[segment.classification]}
            </span>
            <span className="ml-auto text-xs font-medium tabular-nums text-slate-300">
              {segment.count}
            </span>
          </div>
        ))}
      </div>
      {totalVendors > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {totalVendors} vendor{totalVendors === 1 ? '' : 's'} in scope
        </p>
      )}
    </div>
  )
}