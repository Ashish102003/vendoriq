import { cn } from '../../utils/cn'

interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
  /** Renders a skeleton header bar on top (for table-with-header layouts). */
  headerBlock?: boolean
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
  headerBlock = true,
}: TableSkeletonProps) {
  return (
    <div className={cn('px-5 py-4', className)} aria-hidden>
      {headerBlock && (
        <div className="flex h-9 w-48 animate-skeleton items-end rounded-md bg-slate-800/80" />
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid items-center gap-6 border-b border-slate-800/50 py-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className={cn(
                'h-3.5 animate-skeleton rounded bg-slate-800/70',
                colIndex === 0 && 'h-8 w-8 rounded-md',
              )}
              style={{
                width:
                  colIndex === 0
                    ? undefined
                    : `${60 + ((colIndex * 13 + rowIndex) % 35)}%`,
                opacity: 1 - rowIndex / (rows * 2),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}