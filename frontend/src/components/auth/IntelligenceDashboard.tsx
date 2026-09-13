import type { ReactNode } from 'react'
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { AnimatedBarChart } from './AnimatedBarChart'
import { AnimatedDeliveryLine } from './AnimatedDeliveryLine'
import { AnimatedRiskDonut } from './AnimatedRiskDonut'
import type { InsightFocus } from './insights'
import { cn } from '../../utils/cn'

interface IntelligenceDashboardProps {
  focus: InsightFocus
  riskScore: number
}

const NAV: Array<{ icon: LucideIcon; label: string }> = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: Users, label: 'Vendors' },
  { icon: Gauge, label: 'Performance' },
  { icon: ShieldAlert, label: 'Risk' },
  { icon: BarChart3, label: 'Analytics' },
]

const ACTIVITY = [
  { label: 'Delivery update', time: '2m', tone: 'bg-cyan-400' },
  { label: 'Vendor review completed', time: '8m', tone: 'bg-emerald-400' },
  { label: 'Risk score updated', time: '15m', tone: 'bg-amber-400' },
  { label: 'Incident acknowledged', time: '38m', tone: 'bg-indigo-400/70' },
]

interface KpiProps {
  label: string
  value: string
  delta?: string
  sub?: string
}

function Kpi({ label, value, delta, sub }: KpiProps) {
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-md border border-slate-700/40 bg-slate-900/50 px-2 py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm leading-none font-semibold tabular-nums text-white">
          {value}
        </span>
        {delta && (
          <span className="text-[6px] font-semibold text-emerald-400">{delta}</span>
        )}
      </div>
      <span className="mt-1 text-[7px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {sub && (
        <span className="text-[6px] font-semibold uppercase tracking-[0.1em] text-emerald-400/90">
          {sub}
        </span>
      )}
    </div>
  )
}

interface PanelProps {
  title?: string
  accent?: string
  active?: boolean
  className?: string
  children: ReactNode
}

function Panel({ title, accent, active = false, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col rounded-md border border-slate-700/40 bg-slate-900/50 p-1.5',
        active && 'border-blue-500/30',
        className,
      )}
    >
      {title && (
        <header className="mb-1 flex items-center justify-between gap-1">
          <span
            className={cn(
              'flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.16em] transition-colors duration-500',
              active ? 'text-blue-200' : 'text-slate-500',
            )}
          >
            <span
              className={cn(
                'h-1 w-1 rounded-full transition-colors duration-500',
                active ? 'bg-blue-400' : 'bg-slate-600',
              )}
            />
            {title}
          </span>
          {accent && (
            <span className={cn('text-[6px] font-semibold', active ? 'text-cyan-300' : 'text-slate-500')}>
              {accent}
            </span>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * The complete miniature VendorIQ application rendered inside the laptop
 * screen: app header, compact sidebar, KPI cards, the three animated visuals
 * (performance bars, risk donut, delivery trend) and a mostly-static recent
 * activity panel.
 *
 * Visual hierarchy: the animated charts are the primary focus; KPIs, activity
 * and sidebar are smaller second-level detail. Secondary elements collapse on
 * small screens so only the three main visuals stay readable.
 */
export function IntelligenceDashboard({ focus, riskScore }: IntelligenceDashboardProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a1220]">
      {/* app header */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 py-1.5 pl-2 pr-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-gradient-to-br from-blue-500 to-indigo-600">
            <ShieldCheck className="h-2.5 w-2.5 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[10px] font-bold tracking-tight text-slate-100">
            VendorIQ
          </span>
        </div>
        <span className="flex items-center gap-1 text-[7px] font-medium tracking-[0.18em] text-slate-400">
          <span className="animate-pulse h-1 w-1 rounded-full bg-emerald-400" aria-hidden="true" />
          LIVE DATA
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* compact sidebar */}
        <nav
          className="hidden w-11 shrink-0 flex-col items-center justify-between border-r border-slate-800/80 bg-slate-950/60 py-2 sm:flex"
          aria-hidden="true"
        >
          <div className="flex w-full flex-col items-center gap-1">
            {NAV.map((item, index) => {
              const Icon = item.icon
              return (
                <span
                  key={item.label}
                  title={item.label}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                    index === 0
                      ? 'bg-blue-600/25 text-blue-300 ring-1 ring-blue-500/30'
                      : 'text-slate-500',
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.8} />
                </span>
              )
            })}
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600">
            <Settings className="h-3 w-3" strokeWidth={1.8} />
          </span>
        </nav>

        {/* main content */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
          <div className="hidden items-center justify-between px-0.5 sm:flex">
            <span className="text-[9px] font-medium text-slate-400">
              Good morning, Admin
            </span>
            <span className="text-[7px] tabular-nums text-slate-500">
              09:41 · Mon
            </span>
          </div>

          {/* KPI cards */}
          <div className="hidden grid-cols-3 gap-2 sm:grid">
            <Kpi label="Vendors" value="127" delta="+4" />
            <Kpi label="On-time" value="87%" delta="+2%" />
            <Kpi label="Risk" value="31" sub="Low risk" />
          </div>

          {/* primary charts — performance bars + risk donut */}
          <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
            <Panel
              title="Performance"
              accent="+12%"
              active={focus === 'performance'}
              className="col-span-3"
            >
              <div className="flex h-full items-center">
                <AnimatedBarChart
                  values={[62, 70, 78, 88, 58, 74, 82, 66]}
                  active={focus === 'performance'}
                  className="h-16 w-full"
                />
              </div>
            </Panel>
            <Panel
              title="Risk Analysis"
              accent="Low"
              active={focus === 'risk'}
              className="col-span-2"
            >
              <div className="flex h-full items-center justify-center">
                <AnimatedRiskDonut score={riskScore} active={focus === 'risk'} />
              </div>
            </Panel>
          </div>

          {/* secondary row — delivery trend + recent activity */}
          <div className="grid h-[54px] shrink-0 grid-cols-5 gap-2">
            <Panel
              title="Delivery Trend"
              accent="+2%"
              active={focus === 'delivery'}
              className="col-span-5 sm:col-span-3"
            >
              <div className="flex h-full items-center">
                <AnimatedDeliveryLine active={focus === 'delivery'} />
              </div>
            </Panel>
            <Panel
              title="Recent Activity"
              className="hidden sm:col-span-2 sm:block"
            >
              <ul className="iq-insight-in flex h-full flex-col justify-center gap-1">
                {ACTIVITY.map((item, index) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-1.5 text-[7px] text-slate-400"
                  >
                    <span
                      className={cn(
                        'h-1 w-1 shrink-0 rounded-full',
                        item.tone,
                        index === 0 && 'iq-node-pulse',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-slate-500">
                      {item.time}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}