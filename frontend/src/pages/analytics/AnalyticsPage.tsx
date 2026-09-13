import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Eye,
  Info,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { PerformanceClassificationBadge } from '../../components/performance/PerformanceClassificationBadge'
import { ChartCard } from '../../components/analytics/ChartCard'
import { DistributionBar } from '../../components/analytics/DistributionBar'
import { SeverityPieChart } from '../../components/analytics/SeverityPieChart'
import { TrendChart } from '../../components/analytics/TrendChart'
import { ComparisonChart } from '../../components/analytics/ComparisonChart'
import { EmptyChart } from '../../components/analytics/EmptyChart'
import { TREND_COLORS } from '../../components/analytics/chartTheme'
import { analyticsApi, vendorsApi, vendorCategoriesApi } from '../../services/api'
import { cn } from '../../utils/cn'
import type {
  AnalyticsInsight,
  AnalyticsOverview,
  AnalyticsQuery,
  CategoryPerformance,
  DeliveryTrend,
  IncidentTrend,
  PerformanceDistribution,
  PerformanceTrend,
  QualityTrend,
  VendorComparison,
  VendorRanking,
  IncidentSeverityDistribution,
  VendorListItem,
  VendorCategoryWithCount,
} from '../../types'

const inputClass =
  'h-9 rounded-md border border-slate-700/80 bg-slate-800/40 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'

const numberOrDash = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : String(Number(value.toFixed(1)))

const insightIcon = (kind: AnalyticsInsight['kind']) => {
  if (kind === 'positive') return TrendingUp
  if (kind === 'watch') return Eye
  if (kind === 'warning') return AlertTriangle
  return Info
}

const insightClasses: Record<AnalyticsInsight['kind'], string> = {
  positive: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  watch: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  warning: 'border-orange-500/25 bg-orange-500/10 text-orange-200',
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
}

interface DashboardData {
  overview: AnalyticsOverview
  distribution: PerformanceDistribution
  ranking: VendorRanking
  deliveryTrend: DeliveryTrend
  qualityTrend: QualityTrend
  incidentTrend: IncidentTrend
  severity: IncidentSeverityDistribution
  performanceTrend: PerformanceTrend
  categories: CategoryPerformance
}

function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string
  hint?: string
  className?: string
}) {
  return (
    <div className="rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', className)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function AnalyticsPage() {
  const [searchParams] = useSearchParams()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [granularity, setGranularity] = useState<'monthly' | 'daily'>('monthly')
  const [categoryId, setCategoryId] = useState('')
  const [vendorId, setVendorId] = useState(() => {
    const urlVendor = searchParams.get('vendor_id')
    return urlVendor && /^\d+$/.test(urlVendor) ? urlVendor : ''
  })

  const [appliedQuery, setAppliedQuery] = useState<AnalyticsQuery>(() => {
    const urlVendor = searchParams.get('vendor_id')
    return urlVendor && /^\d+$/.test(urlVendor)
      ? { vendor_id: Number(urlVendor) }
      : {}
  })
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [categories, setCategories] = useState<VendorCategoryWithCount[]>([])

  const [compareIds, setCompareIds] = useState<number[]>([])
  const [comparison, setComparison] = useState<VendorComparison | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    vendorsApi
      .list({ page_size: 500, sort_by: 'company_name', sort_order: 'asc' })
      .then((result) => {
        if (active) setVendors(result.items)
      })
      .catch(() => {})
    vendorCategoriesApi
      .list()
      .then((result) => {
        if (active) setCategories(result)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([
      analyticsApi.overview(appliedQuery),
      analyticsApi.distribution(appliedQuery),
      analyticsApi.ranking(appliedQuery),
      analyticsApi.deliveryTrend({ ...appliedQuery, granularity: appliedQuery.granularity ?? granularity }),
      analyticsApi.qualityTrend({ ...appliedQuery, granularity: appliedQuery.granularity ?? granularity }),
      analyticsApi.incidentTrend({ ...appliedQuery, granularity: appliedQuery.granularity ?? granularity }),
      analyticsApi.severityDistribution(appliedQuery),
      analyticsApi.performanceTrend(appliedQuery),
      analyticsApi.categories(appliedQuery),
    ])
      .then(
        ([
          overview,
          distribution,
          ranking,
          deliveryTrend,
          qualityTrend,
          incidentTrend,
          severity,
          performanceTrend,
          categoriesResult,
        ]) => {
          if (!active) return
          setData({
            overview,
            distribution,
            ranking,
            deliveryTrend,
            qualityTrend,
            incidentTrend,
            severity,
            performanceTrend,
            categories: categoriesResult,
          })
        },
      )
      .catch((err) => {
        if (!active) return
        const message =
          err instanceof Error ? err.message : 'Failed to load analytics'
        setError(message)
        setData(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, reloadKey])

  const applyFilters = () => {
    const activeVendor = vendorId === '' ? undefined : Number(vendorId)
    const query: AnalyticsQuery = {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      vendor_id: activeVendor,
      category_id: categoryId === '' ? undefined : Number(categoryId),
    }
    setAppliedQuery(query)
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setGranularity('monthly')
    setCategoryId('')
    setVendorId('')
    setAppliedQuery({})
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const toggleCompareVendor = (id: number) => {
    setComparisonError(null)
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const runComparison = () => {
    if (compareIds.length < 2) {
      setComparisonError('Select at least 2 vendors to compare.')
      return
    }
    setComparisonError(null)
    setComparisonLoading(true)
    setComparison(null)
    analyticsApi
      .comparison(compareIds, appliedQuery)
      .then((result) => setComparison(result))
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : 'Failed to compare vendors'
        setComparisonError(message)
      })
      .finally(() => setComparisonLoading(false))
  }

  const overviewChange = data?.overview.performance_change ?? null
  const changeDirection =
    overviewChange === null
      ? 'neutral'
      : overviewChange === 0
        ? 'neutral'
        : overviewChange > 0
          ? 'up'
          : 'down'

  const deliverySeries = useMemo(
    () => [
      { key: 'on_time_rate', label: 'On-time rate (%)', color: TREND_COLORS.delivery },
      { key: 'delivery_score', label: 'Delivery score', color: '#38bdf8' },
    ],
    [],
  )

  return (
    <AppLayout title="Advanced Analytics">
      <PageHeader
        title="Advanced Analytics"
        subtitle="Analyze vendor performance, operational trends, and historical patterns."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-5 lg:flex-row lg:items-end">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:flex-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Granularity</span>
            <select
              value={granularity}
              onChange={(e) =>
                setGranularity(e.target.value as 'monthly' | 'daily')
              }
              className={inputClass}
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Vendor</span>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={inputClass}
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={String(vendor.id)}>
                  {vendor.company_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/40"
          >
            Reset
          </button>
        </div>
      </div>
      {granularity === 'daily' && (
        <p className="mt-2 text-xs text-slate-500">
          Daily charts require an explicit date range under 62 days.
        </p>
      )}

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : loading || !data ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span className="text-sm">Loading analytics…</span>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
            <StatCard
              label="Average Performance Score"
              value={
                data.overview.average_performance_score === null
                  ? '—'
                  : numberOrDash(data.overview.average_performance_score)
              }
              hint={`${data.overview.vendors_with_score} of ${data.overview.vendors_in_scope} vendors scored`}
            />
            <StatCard
              label="Vendors Requiring Attention"
              value={String(data.overview.vendors_requiring_attention)}
              hint="Poor/Critical or open incidents"
              className="text-red-400"
            />
            <StatCard
              label="Performance Change"
              value={
                changeDirection === 'neutral'
                  ? '—'
                  : `${overviewChange! > 0 ? '+' : ''}${numberOrDash(overviewChange)}`
              }
              hint={
                changeDirection === 'up'
                  ? `${data.overview.performance_change_period_label ?? ''} · improving`
                  : changeDirection === 'down'
                    ? `${data.overview.performance_change_period_label ?? ''} · declining`
                    : data.overview.performance_change_period_label ?? undefined
              }
              className={
                changeDirection === 'up'
                  ? 'text-emerald-400'
                  : changeDirection === 'down'
                    ? 'text-red-400'
                    : 'text-slate-100'
              }
            />
            <StatCard
              label="Open Incidents"
              value={String(data.overview.incidents.unresolved)}
              hint={`${data.overview.incidents.overdue} overdue`}
              className="text-amber-300"
            />
          </div>

          <p className="mt-3 text-[13px] text-slate-500">
            <span className="font-medium text-slate-200">How to read this:</span>{' '}
            Combine the average score, attention count, and change direction to gauge
            portfolio health. A declining score coinciding with rising open incidents is
            an early-warning pattern worth investigating in individual vendor profiles.
          </p>

          {data.overview.insights.length > 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.overview.insights.map((insight) => {
                const Icon = insightIcon(insight.kind)
                return (
                  <div
                    key={insight.key}
                    className={cn(
                      'flex gap-3 rounded-xl border p-5',
                      insightClasses[insight.kind],
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="mt-0.5 text-xs opacity-90">{insight.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Performance Distribution"
              subtitle="Classification of vendors in scope"
            >
              <DistributionBar
                items={data.distribution.items}
                totalVendors={data.distribution.total_vendors}
              />
            </ChartCard>

            <ChartCard
              title="Vendor Ranking"
              subtitle="Top vendors by current overall score"
              action={
                <Link
                  to="/vendor-performance"
                  className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                >
                  View all
                </Link>
              }
            >
              {data.ranking.items.length === 0 ? (
                <EmptyChart message="No vendors have a performance score yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="iq-table-body w-full text-left text-sm">
                    <thead className="iq-table-head">
                      <tr className="border-b border-slate-800">
                        <th className="iq-th">#</th>
                        <th className="iq-th">Vendor</th>
                        <th className="iq-th text-right">Score</th>
                        <th className="iq-th text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.ranking.items.slice(0, 8).map((item) => (
                        <tr key={item.vendor_id} className="iq-row-hover">
                          <td className="iq-td text-slate-500">{item.rank}</td>
                          <td className="iq-td">
                            <Link
                              to={`/vendors/${item.vendor_id}`}
                              className="font-medium text-slate-100 hover:text-indigo-300"
                            >
                              {item.vendor_name}
                            </Link>
                          </td>
                          <td className="iq-td text-right font-medium">
                            {numberOrDash(item.overall_score)}
                          </td>
                          <td className="iq-td text-right">
                            <PerformanceClassificationBadge
                              classification={item.classification}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Delivery Trend"
              subtitle="On-time rate and delivery score over time"
              action={
                <span className="text-xs text-slate-500">
                  {data.deliveryTrend.summary.completed_orders} completed
                </span>
              }
            >
              {!data.deliveryTrend.has_sufficient_data ? (
                <EmptyChart />
              ) : (
                <TrendChart
                  data={data.deliveryTrend.items.map((item) => ({
                    period: item.period,
                    on_time_rate: item.on_time_rate,
                    delivery_score: item.delivery_score,
                  }))}
                  series={deliverySeries}
                  yDomain={[0, 100]}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Quality Trend"
              subtitle="Average evaluation score over time"
              action={
                <span className="text-xs text-slate-500">
                  {data.qualityTrend.summary.total_evaluations} evaluations
                </span>
              }
            >
              {!data.qualityTrend.has_sufficient_data ? (
                <EmptyChart />
              ) : (
                <TrendChart
                  data={data.qualityTrend.items.map((item) => ({
                    period: item.period,
                    average_score: item.average_score,
                  }))}
                  series={[
                    {
                      key: 'average_score',
                      label: 'Average quality score',
                      color: TREND_COLORS.quality,
                    },
                  ]}
                  yDomain={[0, 100]}
                />
              )}
            </ChartCard>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Incident Trend"
              subtitle="Incident score over time"
              action={
                <span className="text-xs text-slate-500">
                  {data.incidentTrend.summary.total_incidents} incidents
                </span>
              }
            >
              {!data.incidentTrend.has_sufficient_data ? (
                <EmptyChart />
              ) : (
                <TrendChart
                  data={data.incidentTrend.items.map((item) => ({
                    period: item.period,
                    incident_score: item.incident_score,
                  }))}
                  series={[
                    {
                      key: 'incident_score',
                      label: 'Incident score',
                      color: TREND_COLORS.incident,
                    },
                  ]}
                  yDomain={[0, 100]}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Incident Severity"
              subtitle="Distribution of incident severities"
              action={
                <span className="text-xs text-slate-500">
                  {data.severity.total_incidents} incidents
                </span>
              }
            >
              {data.severity.total_incidents === 0 ? (
                <EmptyChart message="No incidents have been logged." />
              ) : (
                <SeverityPieChart data={data.severity.items} />
              )}
            </ChartCard>
          </div>

          <div className="mt-8">
            <ChartCard
              title="Historical Performance Trend"
              subtitle="Average vendor performance score across periods"
            >
              {!data.performanceTrend.has_sufficient_data || data.performanceTrend.items.length === 0 ? (
                <EmptyChart />
              ) : (
                <TrendChart
                  data={data.performanceTrend.items.map((item) => ({
                    period: item.period,
                    average_overall_score: item.average_overall_score,
                  }))}
                  series={[
                    {
                      key: 'average_overall_score',
                      label: 'Average overall score',
                      color: TREND_COLORS.performance,
                    },
                  ]}
                  yDomain={[0, 100]}
                  height={260}
                />
              )}
            </ChartCard>
          </div>

          <div className="mt-8">
            <ChartCard
              title="Category Performance"
              subtitle="Average scores grouped by vendor category"
            >
              {data.categories.items.length === 0 ? (
                <EmptyChart message="No categories have vendors with operational data." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="iq-table-body w-full text-left text-sm">
                    <thead className="iq-table-head">
                      <tr className="border-b border-slate-800">
                        <th className="iq-th">Category</th>
                        <th className="iq-th text-right">Vendors</th>
                        <th className="iq-th text-right">Avg Overall</th>
                        <th className="iq-th text-right">Avg Delivery</th>
                        <th className="iq-th text-right">Avg Quality</th>
                        <th className="iq-th text-right">Avg Incidents</th>
                        <th className="iq-th text-right">Best Vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.categories.items.map((item) => (
                        <tr key={item.category_id} className="iq-row-hover">
                          <td className="iq-td font-medium text-slate-100">
                            {item.category_name}
                          </td>
                          <td className="iq-td text-right">
                            {item.vendor_count}
                          </td>
                          <td className="iq-td text-right font-medium">
                            {numberOrDash(item.average_overall_score)}
                          </td>
                          <td className="iq-td text-right">
                            {numberOrDash(item.average_delivery_score)}
                          </td>
                          <td className="iq-td text-right">
                            {numberOrDash(item.average_quality_score)}
                          </td>
                          <td className="iq-td text-right">
                            {numberOrDash(item.average_incident_score)}
                          </td>
                          <td className="iq-td text-right">
                            {item.best_vendor_name ? (
                              <span className="font-medium text-indigo-300">
                                {item.best_vendor_name}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="mt-8">
            <ChartCard
              title="Vendor Comparison"
              subtitle="Compare up to 5 vendors across performance components"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="max-h-56 flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-800/30 p-2">
                    {vendors.length === 0 ? (
                      <p className="p-2 text-xs text-slate-500">
                        No vendors available.
                      </p>
                    ) : (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {vendors.map((vendor) => {
                          const selected = compareIds.includes(vendor.id)
                          const disabled = !selected && compareIds.length >= 5
                          return (
                            <label
                              key={vendor.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/[0.04]',
                                disabled && 'cursor-not-allowed opacity-50',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={disabled}
                                onChange={() => toggleCompareVendor(vendor.id)}
                                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                              />
                              <span className="truncate text-slate-300">
                                {vendor.company_name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={runComparison}
                    disabled={comparisonLoading || compareIds.length < 2}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {comparisonLoading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Compare ({compareIds.length})
                  </button>
                </div>
                {comparisonError && (
                  <p className="text-sm text-red-400">{comparisonError}</p>
                )}
                {comparison && comparison.vendors.length > 0 && (
                  <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <div className="overflow-x-auto">
                      <table className="iq-table-body w-full text-left text-sm">
                        <thead className="iq-table-head">
                          <tr className="border-b border-slate-800">
                            <th className="iq-th">Vendor</th>
                            <th className="iq-th text-right">Score</th>
                            <th className="iq-th text-right">Classification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {comparison.vendors.map((metric) => (
                            <tr key={metric.vendor_id} className="iq-row-hover">
                              <td className="iq-td">
                                <Link
                                  to={`/vendors/${metric.vendor_id}`}
                                  className="font-medium text-slate-100 hover:text-indigo-300"
                                >
                                  {metric.vendor_name}
                                </Link>
                                <p className="font-mono text-xs text-slate-500">
                                  {metric.vendor_code}
                                </p>
                              </td>
                              <td className="iq-td text-right font-medium">
                                {numberOrDash(metric.overall_score)}
                              </td>
                              <td className="iq-td text-right">
                                <PerformanceClassificationBadge
                                  classification={metric.classification}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ComparisonChart vendors={comparison.vendors} />
                  </div>
                )}
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </AppLayout>
  )
}