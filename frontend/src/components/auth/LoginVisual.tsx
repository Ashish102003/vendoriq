import { useEffect, useState } from 'react'
import { LaptopPreview } from './LaptopPreview'
import { IntelligenceDashboard } from './IntelligenceDashboard'
import { RotatingInsight } from './RotatingInsight'
import { INSIGHTS, INSIGHT_MS, RISK_SCORES } from './insights'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/**
 * Composes the entire left half of the login page: a soft product glow behind
 * a premium laptop mockup that runs the compact VendorIQ intelligence
 * dashboard, with a rotating live-intelligence message underneath.
 *
 * A single timer advances the message cycle; the active message selects which
 * dashboard visual is highlighted and nudges the slowly-changing risk score,
 * so the preview reads like VendorIQ is actively analysing data.
 */
export function LoginVisual() {
  const reduced = usePrefersReducedMotion()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (reduced) {
      return
    }
    const intervalId = window.setInterval(() => setTick((t) => t + 1), INSIGHT_MS)
    return () => window.clearInterval(intervalId)
  }, [reduced])

  const index = reduced ? 0 : tick % INSIGHTS.length
  const insight = INSIGHTS[index]

  return (
    <div className="relative flex w-full flex-col items-center">
      <div
        className="iq-glow-drift pointer-events-none absolute top-1/2 left-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/18 blur-3xl max-sm:hidden"
        aria-hidden="true"
      />
      <div
        className="iq-glow-drift pointer-events-none absolute top-1/2 left-1/2 h-[88%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-3xl max-sm:hidden"
        aria-hidden="true"
      />

      <div
        className="relative z-10 flex w-full items-center justify-center gap-10"
        aria-hidden="true"
      >
        <span
          className="hidden text-[9px] font-medium tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl] rotate-180 xl:block"
          aria-hidden="true"
        >
          PERFORMANCE
        </span>
        <LaptopPreview className="flex-1 min-w-[230px]">
          <IntelligenceDashboard focus={insight.focus} riskScore={RISK_SCORES[index]} />
        </LaptopPreview>
        <span
          className="hidden text-[9px] font-medium tracking-[0.3em] text-slate-500 [writing-mode:vertical-rl] xl:block"
          aria-hidden="true"
        >
          DELIVERY · RISK
        </span>
      </div>

      <div className="relative z-10 mt-9 w-full text-center">
        <RotatingInsight text={insight.text} tone={insight.tone} />
      </div>
    </div>
  )
}