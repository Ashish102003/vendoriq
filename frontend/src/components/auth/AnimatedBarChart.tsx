import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

interface AnimatedBarChartProps {
  /** Base bar heights (percentages of the container height). */
  values: number[]
  /** Whether this visual is the currently active intelligence focus. */
  active?: boolean
  className?: string
}

/**
 * Decorative performance bars: each bar rises from the bottom once on page
 * load (staggered by its index), then breathes gently between its base height
 * and a slightly shorter height forever with slightly different timing, so the
 * chart stays alive without excessive bouncing or jumping.
 */
export function AnimatedBarChart({
  values,
  active = false,
  className,
}: AnimatedBarChartProps) {
  return (
    <div
      className={cn('flex items-end gap-1.5', className)}
      aria-hidden="true"
    >
      {values.map((value, index) => (
        <div
          key={index}
          className={cn(
            'iq-bar flex-1 rounded-t-[2px]',
            active
              ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]'
              : 'bg-gradient-to-t from-blue-600/30 to-blue-400/40',
          )}
          style={
            {
              '--bar-h': `${value}%`,
              '--bar-delay': `${index * 0.13}s`,
              animationDuration: `1.1s, ${(3.2 + (index % 4) * 0.6).toFixed(1)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}