import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/common/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { ChartCard } from '../components/analytics/ChartCard'
import { TrendChart } from '../components/analytics/TrendChart'
import { PageLoader } from '../components/common/PageLoader'
import { ErrorState } from '../components/common/ErrorState'
import { Button } from '../components/ui/Button'
import { TREND_COLORS, chartTooltipStyle } from '../components/analytics/chartTheme'
import { useAuth } from '../context/auth-context'
import {
  analyticsApi,
  contractsApi,
  vendorRiskApi,
  vendorsApi,
} from '../services/api'
import { formatCurrency } from '../utils/format'
import type {
  AnalyticsInsight,
  AnalyticsOverview,
  DeliveryTrend,
  PerformanceTrend,
  RiskStatistics,
  VendorRanking,
} from '../types'

const INSIGHT_KINDS: Record<
  AnalyticsInsight['kind'],
  { icon: typeof AlertTriangle; className: string }
> = {
  positive: { icon: ShieldCheck, className: 'text-emerald-400' },
  watch: { icon: Clock, className: 'text-amber-300' },
  warning: { icon: AlertTriangle, className: 'text-red-400' },
  info: { icon: Sparkles, className: 'text-indigo-300' },
}

const QUICK_LINKS = [
  { label: 'Vendor Directory', to: '/vendors', icon: Building2, description: 'Manage vendor lifecycle and profiles.' },
  { label: 'Risk Center', to: '/vendor-risk', icon: ShieldAlert, description: 'Monitor predictive risk levels across the base.' },
  { label: 'Performance Analytics', to: '/vendor-performance', icon: Gauge, description: 'Explore scores, subscores and classifications.' },
  { label: 'Advanced Analytics', to: '/analytics', icon: Layers, description: 'Trends, rankings and comparative intelligence.' },
]

interface RiskSlice {
  key: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  count: number
  color: string
  text: string
}

const RISK_SLICE_META: Record<RiskSlice['key'], { color: string; text: string }> = {
  VERY_LOW: { color: '#10b981', text: 'Very Low' },
  LOW: { color: '#22c55e', text: 'Low' },
  MEDIUM: { color: '#f59e0b', text: 'Medium' },
  HIGH: { color: '#f97316', text: 'High' },
  CRITICAL: { color: '#dc2626', text: 'Critical' },
}

function riskSlices(stats: RiskStatistics): RiskSlice[] {
  return [
    { key: 'VERY_LOW', count: stats.very_low_risk, ...RISK_SLICE_META.VERY_LOW },
    { key: 'LOW', count: stats.low_risk, ...RISK_SLICE_META.LOW },
    { key: 'MEDIUM', count: stats.medium_risk, ...RISK_SLICE_META.MEDIUM },
    { key: 'HIGH', count: stats.high_risk, ...RISK_SLICE_META.HIGH },
    { key: 'CRITICAL', count: stats.critical_risk, ...RISK_SLICE_META.CRITICAL },
  ]
}

function RiskDonut({ stats }: { stats: RiskStatistics }) {
  const slices = riskSlices(stats).filter((slice) => slice.count > 0)
  const total = riskSlices(stats).reduce((sum, slice) => sum + slice.count, 0)

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="text"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="transparent"
            >
              {slices.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} vendors`, String(name)]}
              contentStyle={chartTooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl leading-none font-bold tabular-nums text-slate-100">
              {total}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Assessed
            </p>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {riskSlices(stats).map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="w-20 text-xs text-slate-400">{slice.text}</span>
            <span className="text-xs font-medium tabular-nums text-slate-200">
              {slice.count}
            </span>
          </li>
        ))}
        {stats.no_data > 0 && (
          <li className="pt-1 text-xs text-slate-500">
            {stats.no_data} with no risk data
          </li>
        )}
      </ul>
    </div>
  )
}

function ClassificationGlyph({ classification }: { classification: string }) {
  const color: Record<string, string> = {
    EXCELLENT: 'bg-emerald-400',
    GOOD: 'bg-green-400',
    AVERAGE: 'bg-amber-400',
    POOR: 'bg-orange-400',
    CRITICAL: 'bg-red-400',
    INSUFFICIENT_DATA: 'bg-slate-600',
  }
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color[classification] ?? 'bg-slate-600'}`}
    />
  )
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const

type RangeSelection = { label: string; start_date?: string }

function DateRangeSelector({
  value,
  onChange,
}: {
  value: RangeSelection
  onChange: (next: RangeSelection) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(option: (typeof RANGE_OPTIONS)[number]) {
    const start = new Date()
    start.setDate(start.getDate() - option.days)
    onChange({ label: option.label, start_date: start.toISOString().slice(0, 10) })
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/40 px-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700/50"
      >
        <CalendarClock className="h-4 w-4 text-slate-400" />
        {value.label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-lg border border-slate-700/80 bg-[#121a2b] py-1 shadow-xl shadow-black/40">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => select(option)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
            >
              {option.label}
              {value.label === option.label && (
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DeliverySnapshot({
  overview,
  trend,
}: {
  overview: AnalyticsOverview
  trend: DeliveryTrend | null
}) {
  const delivery = overview.delivery

  const metrics = [
    { label: 'On time', value: String(delivery.on_time_deliveries ?? 0), tone: 'text-emerald-400' },
    { label: 'Delayed', value: String(delivery.delayed_deliveries ?? 0), tone: 'text-orange-400' },
    { label: 'Pending', value: String(delivery.pending_orders ?? 0), tone: 'text-slate-100' },
    {
      label: 'Avg delay',
      value:
        delivery.average_delay_days === null || delivery.average_delay_days === undefined
          ? '—'
          : `${Math.round(delivery.average_delay_days)}d`,
      tone: 'text-slate-100',
    },
  ]

  const chartData =
    trend?.has_sufficient_data && trend.items.length > 0
      ? trend.items.map((item) => ({
          period: item.period,
          on_time_rate: item.on_time_rate,
          delayed_rate:
            item.on_time_rate === null ? null : Math.round((100 - item.on_time_rate) * 10) / 10,
        }))
      : null

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {metric.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${metric.tone}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {chartData ? (
          <TrendChart
            data={chartData}
            series={[
              { key: 'on_time_rate', label: 'On-time rate', color: TREND_COLORS.quality },
              { key: 'delayed_rate', label: 'Delayed rate', color: '#fb923c' },
            ]}
            yDomain={[0, 100]}
            height={180}
            valueFormatter={(value) => `${value}%`}
          />
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            Not enough delivery data to chart a trend.
          </p>
        )}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<RangeSelection>({ label: 'Last 30 days' })
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [riskStats, setRiskStats] = useState<RiskStatistics | null>(null)
  const [vendorStats, setVendorStats] = useState<{ total_vendors: number; active_vendors: number } | null>(null)
  const [contractStats, setContractStats] = useState<{ active_contracts: number; total_contract_value: string } | null>(null)
  const [ranking, setRanking] = useState<VendorRanking | null>(null)
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrend | null>(null)
  const [deliveryTrend, setDeliveryTrend] = useState<DeliveryTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const query = range.start_date ? { start_date: range.start_date } : {}

    Promise.all([
      analyticsApi.overview(query),
      vendorRiskApi.statistics(),
      vendorsApi.statistics(),
      contractsApi.statistics(),
      analyticsApi.ranking(query),
      analyticsApi.performanceTrend(query),
      analyticsApi.deliveryTrend(query),
    ])
      .then(([ov, rs, vs, cs, rk, pt, dt]) => {
        if (!active) return
        setOverview(ov)
        setRiskStats(rs)
        setVendorStats(vs)
        setContractStats(cs)
        setRanking(rk)
        setPerformanceTrend(pt)
        setDeliveryTrend(dt)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey, range.start_date])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const firstName = user?.first_name ?? 'there'
  const insights = overview?.insights ?? []
  const onTimeRate = overview?.delivery.on_time_rate ?? null
  const avgRisk = riskStats?.average_risk_score ?? null
  const trendChartData =
    performanceTrend && performanceTrend.has_sufficient_data && performanceTrend.items.length > 0
      ? performanceTrend.items.map((item) => ({
          period: item.period,
          average_overall_score: item.average_overall_score,
        }))
      : null

  const kpis: {
    label: string
    value: string | number
    icon: ReactNode
    accent: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red' | 'sky' | 'orange' | 'teal'
    hint?: string
    to: string
  }[] = [
    {
      label: 'Total Vendors',
      value: vendorStats?.total_vendors ?? 0,
      icon: <Building2 className="h-5 w-5" />,
      accent: 'indigo' as const,
      hint: `${vendorStats?.active_vendors ?? 0} active`,
      to: '/vendors',
    },
    {
      label: 'Active Contracts',
      value: contractStats?.active_contracts ?? 0,
      icon: <FileText className="h-5 w-5" />,
      accent: 'sky' as const,
      hint:
        contractStats && Number(contractStats.total_contract_value) > 0
          ? `Value ${formatCurrency(contractStats.total_contract_value)}`
          : 'No contract value',
      to: '/contracts',
    },
    {
      label: 'On-Time Delivery',
      value: onTimeRate === null ? '—' : `${Math.round(onTimeRate)}%`,
      icon: <Truck className="h-5 w-5" />,
      accent: 'emerald' as const,
      hint: `${overview?.delivery.on_time_deliveries ?? 0}/${overview?.delivery.completed_orders ?? 0} on time`,
      to: '/purchase-orders',
    },
    {
      label: 'Average Risk Score',
      value: avgRisk === null ? '—' : Math.round(avgRisk),
      icon: <ShieldAlert className="h-5 w-5" />,
      accent: avgRisk !== null && avgRisk > 60 ? 'red' : avgRisk !== null && avgRisk > 40 ? 'amber' : 'emerald',
      hint: `${riskStats?.high_risk ?? 0} high · ${riskStats?.critical_risk ?? 0} critical`,
      to: '/vendor-risk',
    },
  ]

  const todayLabel = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })

  return (
    <AppLayout title="Dashboard">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${firstName}`}
        subtitle="Here's what's happening with your vendor ecosystem today."
        actions={
          <>
            <DateRangeSelector value={range} onChange={setRange} />
            <Button asChild>
              <Link to="/analytics">
                Open Analytics
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="iq-card">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : loading ? (
        <div className="iq-card">
          <PageLoader label="Loading your intelligence overview…" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 xl:gap-6">
            {kpis.map((kpi) => (
              <Link
                key={kpi.label}
                to={kpi.to}
                className="block transition-opacity hover:opacity-90"
              >
                <StatCard
                  label={kpi.label}
                  value={kpi.value}
                  icon={kpi.icon}
                  accent={kpi.accent}
                  hint={kpi.hint}
                />
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
            <ChartCard
              className="lg:col-span-2"
              title="Vendor Performance Trend"
              subtitle="Average performance score across all vendors."
            >
              {trendChartData ? (
                <TrendChart
                  data={trendChartData}
                  series={[
                    {
                      key: 'average_overall_score',
                      label: 'Average overall score',
                      color: TREND_COLORS.performance,
                    },
                  ]}
                  yDomain={[0, 100]}
                  height={280}
                />
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  Not enough data to chart performance over this period.
                </p>
              )}
            </ChartCard>

            <ChartCard
              className="lg:col-span-1"
              title="Risk Distribution"
              subtitle="ML-assessed risk across the vendor base."
            >
              {riskStats ? (
                <RiskDonut stats={riskStats} />
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  No risk data available.
                </p>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:gap-8">
            <ChartCard
              title="Top Performing Vendors"
              subtitle="Overall performance score leaders"
            >
              {!ranking || ranking.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No ranked vendors yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800/60">
                  {ranking.items.slice(0, 5).map((item, index) => (
                    <li key={item.vendor_id}>
                      <Link
                        to={`/vendors/${item.vendor_id}`}
                        className="group flex items-center gap-3 rounded-lg px-2 py-3.5 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500">
                          {index + 1}
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/60 text-[11px] font-bold text-slate-300 transition-colors group-hover:border-indigo-500/40 group-hover:text-indigo-200">
                          {item.vendor_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-100">
                            {item.vendor_name}
                          </span>
                          <span className="block text-xs text-slate-500">{item.vendor_code}</span>
                        </span>
                        <ClassificationGlyph classification={item.classification} />
                        <span className="text-sm font-semibold tabular-nums text-slate-100">
                          {item.overall_score}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>

            <ChartCard
              title="Delivery Snapshot"
              subtitle="Purchase order delivery health."
            >
              {overview ? (
                <DeliverySnapshot overview={overview} trend={deliveryTrend} />
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">
                  No delivery data available.
                </p>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
            <ChartCard
              className="lg:col-span-2"
              title="Intelligence Feed"
              subtitle="Automated insights from operational data."
            >
              {insights.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No insights generated for the current data set.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-slate-800/60">
                    {insights.slice(0, 6).map((insight) => {
                      const config = INSIGHT_KINDS[insight.kind]
                      const Icon = config.icon
                      return (
                        <li key={insight.key} className="flex gap-4 px-1 py-4 first:pt-0 last:pb-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-800/50">
                            <Icon className={`h-4 w-4 ${config.className}`} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-100">
                              {insight.title}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                              {insight.detail}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-4 flex items-center gap-1.5 border-t border-slate-800/60 pt-4 text-[11px] text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    {insights.length} signals · updated {todayLabel}
                  </p>
                </>
              )}
            </ChartCard>

            <ChartCard
              title="Quick Access"
              subtitle="Jump straight into a workstream."
            >
              <ul className="space-y-3">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon
                  return (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="group flex items-center gap-4 rounded-lg border border-transparent px-3 py-3.5 transition-colors hover:border-indigo-500/25 hover:bg-white/[0.04]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/60 text-slate-400 transition-colors group-hover:border-indigo-500/40 group-hover:bg-indigo-500/15 group-hover:text-indigo-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-100">
                            {link.label}
                          </span>
                          <span className="block text-xs leading-relaxed text-slate-500">
                            {link.description}
                          </span>
                        </span>
                        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </ChartCard>
          </div>
        </div>
      )}
    </AppLayout>
  )
}