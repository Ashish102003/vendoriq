import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

interface AnimatedRiskDonutProps {
  score: number
  /** Whether this visual is the currently active intelligence focus. */
  active?: boolean
}

const RADIUS = 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Decorative risk donut: a faint static dashed outer ring, a progress arc that
 * draws in once on page load and then transitions live between nearby risk
 * values via the message cycle, and a pulsing halo when risk is the active
 * focus. The ring itself does not spin.
 */
export function AnimatedRiskDonut({ score, active = false }: AnimatedRiskDonutProps) {
  const progress = Math.min(100, Math.max(0, score)) / 100
  const dash = CIRCUMFERENCE * progress

  return (
    <div className="flex h-full items-center" aria-hidden="true">
      <div className="relative mx-auto h-16 w-16 sm:h-24 sm:w-24">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle
            cx="50"
            cy="50"
            r={RADIUS + 4}
            fill="none"
            stroke="rgb(148 163 184 / 0.18)"
            strokeWidth="1"
            strokeDasharray="2 12"
          />
        </svg>

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="rgb(30 41 59 / 0.9)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            className={cn('iq-donut-arc', active ? 'stroke-amber-400' : 'stroke-indigo-400')}
            style={
              {
                '--ring-c': `${CIRCUMFERENCE}`,
                '--ring-dash': `${dash}`,
              } as CSSProperties
            }
          />
        </svg>

        {active && (
          <span className="iq-risk-pulse absolute -inset-1.5 rounded-full border border-amber-400/40" />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            key={score}
            className="iq-insight-in text-sm font-semibold tabular-nums text-white sm:text-lg"
          >
            {score}
          </span>
          <span className="mt-0.5 text-[6px] font-semibold tracking-[0.18em] text-slate-500 sm:text-[7px]">
            RISK
          </span>
        </div>
      </div>
    </div>
  )
}