import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, Clock, ShieldCheck, Sparkles } from 'lucide-react'
import { analyticsApi } from '../../services/api'
import type { AnalyticsInsight } from '../../types'

const KIND_META: Record<
  AnalyticsInsight['kind'],
  { icon: typeof AlertTriangle; className: string }
> = {
  positive: { icon: ShieldCheck, className: 'text-emerald-400' },
  watch: { icon: Clock, className: 'text-amber-300' },
  warning: { icon: AlertTriangle, className: 'text-red-400' },
  info: { icon: Sparkles, className: 'text-indigo-300' },
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [insights, setInsights] = useState<AnalyticsInsight[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    analyticsApi
      .overview()
      .then((overview) => {
        if (active) setInsights(overview.insights)
      })
      .catch(() => {
        if (active) setInsights([])
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const attentionCount = insights.filter(
    (item) => item.kind === 'watch' || item.kind === 'warning',
  ).length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        {attentionCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-slate-700/80 bg-[#121a2b] shadow-xl shadow-black/40"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">Notifications</p>
            <span className="rounded-full border border-slate-700/70 bg-slate-800/50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {insights.length} signals
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {insights.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {insights.slice(0, 5).map((item) => {
                  const meta = KIND_META[item.kind]
                  const Icon = meta.icon
                  return (
                    <li key={item.key} className="px-4 py-3.5">
                      <Link
                        to="/ai-insights"
                        onClick={() => setOpen(false)}
                        className="flex gap-3 rounded-md transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-800/50">
                          <Icon className={`h-3.5 w-3.5 ${meta.className}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-slate-100">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                            {item.detail}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-800/80 px-4 py-2.5">
            <Link
              to="/ai-insights"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
            >
              View all in AI Insights →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}