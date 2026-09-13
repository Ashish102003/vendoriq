import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

interface AnimatedDeliveryLineProps {
  /** Whether this visual is the currently active intelligence focus. */
  active?: boolean
}

const NODES = 6

/**
 * Decorative delivery line: nodes connected by a faint track that draws in
 * left-to-right once on page load, a periodically travelling data particle,
 * and a gently pulsing latest point. When this visual is the active focus the
 * dot and value brighten (cyan) and the particle moves faster.
 */
export function AnimatedDeliveryLine({ active = false }: AnimatedDeliveryLineProps) {
  return (
    <div className="flex h-full items-center" aria-hidden="true">
      <div className="relative flex flex-1 items-center">
        <span className="iq-line-draw absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-slate-700 via-slate-600/80 to-slate-700" />
        <div className="relative z-[1] flex flex-1 items-center justify-between">
          {Array.from({ length: NODES }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-500',
                active ? 'bg-cyan-400' : 'bg-slate-500',
                index === NODES - 1 && 'iq-node-pulse',
              )}
            />
          ))}
        </div>
        <span
          className="iq-travel absolute top-1/2 -translate-y-1/2"
          style={{ animationDuration: active ? '3.2s' : '4.6s' } as CSSProperties}
        >
          <span
            className={cn(
              'block h-2 w-2 -translate-x-1/2 rounded-full transition-colors duration-500',
              active
                ? 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.85)]'
                : 'bg-slate-400/80',
            )}
          />
        </span>
      </div>
      <span
        className={cn(
          'ml-3 text-sm font-semibold tabular-nums transition-colors duration-500',
          active ? 'text-cyan-300' : 'text-slate-300',
        )}
      >
        87%
      </span>
    </div>
  )
}