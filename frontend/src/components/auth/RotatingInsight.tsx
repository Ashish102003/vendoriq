import { cn } from '../../utils/cn'
import type { InsightTone } from './insights'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface RotatingInsightProps {
  text: string
  tone: InsightTone
}

const TONE_COLOR: Record<InsightTone, string> = {
  neutral: 'bg-sky-400',
  positive: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
}

const TONE_TEXT: Record<InsightTone, string> = {
  neutral: 'text-slate-100',
  positive: 'text-emerald-200',
  warning: 'text-amber-200',
  danger: 'text-rose-200',
}

/**
 * The live-intelligence line below the laptop. Keyed by message text, so each
 * new message replays a slow fade-in → hold → fade-out cycle while the static
 * "LIVE INTELLIGENCE" label stays put.
 */
export function RotatingInsight({ text, tone }: RotatingInsightProps) {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="mt-9 text-center">
      <span className="text-[9px] font-medium uppercase tracking-[0.24em] text-slate-500">
        Live Intelligence
      </span>
      <div
        key={text}
        className={cn('mt-2', reduced ? 'iq-insight-in' : 'iq-insight-cycle')}
        role="status"
        aria-live="polite"
      >
        <span className={cn('inline-flex items-center gap-2 text-sm font-medium', TONE_TEXT[tone])}>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className={cn('h-2 w-2 rounded-full', TONE_COLOR[tone])} />
            <span
              className={cn('iq-risk-pulse absolute inset-0 rounded-full opacity-60', TONE_COLOR[tone])}
            />
          </span>
          {text}
        </span>
      </div>
    </div>
  )
}