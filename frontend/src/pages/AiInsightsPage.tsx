import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronRight,
  Clock,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/common/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { ChartCard } from '../components/analytics/ChartCard'
import { PageLoader } from '../components/common/PageLoader'
import { ErrorState } from '../components/common/ErrorState'
import { Button } from '../components/ui/Button'
import { card } from '../styles/classes'
import { RiskLevelBadge } from '../components/risk/RiskLevelBadge'
import { analyticsApi, vendorRiskApi } from '../services/api'
import type {
  AnalyticsInsight,
  AnalyticsOverview,
  ModelInfo,
  PaginatedVendorRiskList,
  RiskStatistics,
  VendorRanking,
} from '../types'

const INSIGHT_KINDS: Record<
  AnalyticsInsight['kind'],
  { icon: typeof AlertTriangle; chip: string; label: string }
> = {
  positive: {
    icon: ShieldCheck,
    chip: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    label: 'Positive signal',
  },
  watch: {
    icon: Clock,
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    label: 'Watch',
  },
  warning: {
    icon: AlertTriangle,
    chip: 'border-red-500/25 bg-red-500/10 text-red-300',
    label: 'Warning',
  },
  info: {
    icon: Sparkles,
    chip: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
    label: 'Insight',
  },
}

function InsightCard({ insight }: { insight: AnalyticsInsight }) {
  const meta = INSIGHT_KINDS[insight.kind]
  const Icon = meta.icon

  return (
    <div className="flex gap-3.5 rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-5">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.chip}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">{insight.title}</p>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {meta.label}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          {insight.detail}
        </p>
      </div>
    </div>
  )
}

function ModelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-200">{children}</span>
    </div>
  )
}

export function AiInsightsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [riskStats, setRiskStats] = useState<RiskStatistics | null>(null)
  const [ranking, setRanking] = useState<VendorRanking | null>(null)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [risklist, setRiskList] = useState<PaginatedVendorRiskList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    Promise.all([
      analyticsApi.overview(),
      vendorRiskApi.statistics(),
      analyticsApi.ranking(),
      vendorRiskApi.modelInfo(),
      vendorRiskApi.list({ page_size: 5, sort_by: 'risk_score', sort_order: 'desc' }),
    ])
      .then(([ov, rs, rk, mi, rl]) => {
        if (!active) return
        setOverview(ov)
        setRiskStats(rs)
        setRanking(rk)
        setModel(mi)
        setRiskList(rl)
      })
      .catch((err) => {
        if (!active) return
        setError(
          err instanceof Error ? err.message : 'Failed to load intelligence data',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const insights = overview?.insights ?? []
  const positive = insights.filter((item) => item.kind === 'positive').length
  const attention = insights.filter(
    (item) => item.kind === 'watch' || item.kind === 'warning',
  ).length
  const totalPredictions =
    (riskStats?.high_confidence_predictions ?? 0) +
    (riskStats?.low_confidence_predictions ?? 0)
  const coverage =
    totalPredictions > 0
      ? `${Math.round(((riskStats?.high_confidence_predictions ?? 0) / totalPredictions) * 100)}%`
      : '—'

  const topPerformers = (ranking?.items ?? []).slice(0, 5)

  return (
    <AppLayout title="AI Insights">
      <PageHeader
        title="AI Insights"
        subtitle="Automated intelligence distilled from performance, delivery, quality and risk signals across your vendor base."
        actions={
          <Button variant="secondary" onClick={handleRetry} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        }
      />

      {error ? (
        <div className="iq-card">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : loading ? (
        <div className="iq-card">
          <PageLoader label="Generating insights…" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 xl:gap-6">
            <StatCard
              label="Signals Generated"
              value={insights.length}
              icon={<Sparkles className="h-5 w-5" />}
              accent="indigo"
              hint="This evaluation period"
            />
            <StatCard
              label="Positive Signals"
              value={positive}
              icon={<ShieldCheck className="h-5 w-5" />}
              accent="emerald"
              hint="Strengths worth reinforcing"
            />
            <StatCard
              label="Needs Attention"
              value={attention}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="amber"
              hint="Watch and warning items"
            />
            <StatCard
              label="Prediction Coverage"
              value={coverage}
              icon={<Brain className="h-5 w-5" />}
              accent="sky"
              hint={`${riskStats?.high_confidence_predictions ?? 0} high-confidence scores`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
            <div className="lg:col-span-2">
              <ChartCard
                title="Generated Insights"
                subtitle="Ranked observations derived from current operational data"
              >
                {insights.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No insights available for the current period.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {insights.map((insight) => (
                      <InsightCard key={insight.key} insight={insight} />
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="space-y-8">
              <div className={card}>
                <div className="flex items-center gap-3 border-b border-slate-800/70 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
                    <Brain className="h-4.5 w-4.5" strokeWidth={1.9} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Prediction Model
                    </h3>
                    <p className="text-xs text-slate-500">
                      {model?.available ? 'Active and serving' : 'Not available'}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-slate-800/60 px-5 py-1">
                  <ModelRow label="Model type">
                    {model?.model_type ?? '—'}
                  </ModelRow>
                  <ModelRow label="Version">
                    {model?.model_version ?? '—'}
                  </ModelRow>
                  <ModelRow label="Training records">
                    {model?.training_records ?? '—'}
                  </ModelRow>
                  <ModelRow label="Last trained">
                    {model?.training_date ?? '—'}
                  </ModelRow>
                </div>
                {model?.evaluation_metrics &&
                  Object.keys(model.evaluation_metrics).length > 0 && (
                    <div className="border-t border-slate-800/70 px-5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Evaluation metrics
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {Object.entries(model.evaluation_metrics).map(
                          ([key, metric]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-500">{key}</span>
                              <span className="font-medium tabular-nums text-slate-200">
                                {typeof metric === 'number'
                                  ? metric.toFixed(3)
                                  : String(metric)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                {!model?.available && model?.message && (
                  <p className="border-t border-slate-800/70 px-5 py-3 text-xs text-slate-500">
                    {model.message}
                  </p>
                )}
              </div>

              <div className={card}>
                <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Risk Watchlist
                  </h3>
                  <Link
                    to="/vendor-risk"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
                  >
                    Risk Center
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {risklist && risklist.items.length > 0 ? (
                  <ul className="divide-y divide-slate-800/60">
                    {risklist.items.map((vendor) => (
                      <li key={vendor.vendor_id}>
                        <Link
                          to={`/vendors/${vendor.vendor_id}`}
                          className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {vendor.vendor_name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {vendor.vendor_code}
                              {vendor.category_name
                                ? ` · ${vendor.category_name}`
                                : ''}
                            </p>
                          </div>
                          {vendor.risk_level ? (
                            <RiskLevelBadge level={vendor.risk_level} />
                          ) : (
                            <span className="text-xs text-slate-500">No data</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-center text-sm text-slate-500">
                    No risk data available.
                  </p>
                )}
              </div>
            </div>
          </div>

          <ChartCard
            title="Top Performers"
            subtitle="Highest ranked vendors by current overall score"
            action={
              <Link
                to="/vendor-performance"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
              >
                Performance
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {topPerformers.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No ranked vendors yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="iq-table-head">
                    <tr>
                      <th className="iq-th">Rank</th>
                      <th className="iq-th">Vendor</th>
                      <th className="iq-th">Delivery</th>
                      <th className="iq-th">Quality</th>
                      <th className="iq-th">Incidents</th>
                      <th className="iq-th text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="iq-table-body">
                    {topPerformers.map((vendor) => (
                      <tr key={vendor.vendor_id} className="iq-row-hover">
                        <td className="iq-td">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700/60 bg-slate-800/50 text-xs font-semibold text-slate-300">
                            {vendor.rank}
                          </span>
                        </td>
                        <td className="iq-td">
                          <Link
                            to={`/vendors/${vendor.vendor_id}`}
                            className="font-medium text-slate-100 transition-colors hover:text-indigo-300"
                          >
                            {vendor.vendor_name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {vendor.vendor_code}
                          </p>
                        </td>
                        <td className="iq-td tabular-nums">
                          {vendor.delivery_score === null
                            ? '—'
                            : vendor.delivery_score.toFixed(1)}
                        </td>
                        <td className="iq-td tabular-nums">
                          {vendor.quality_score === null
                            ? '—'
                            : vendor.quality_score.toFixed(1)}
                        </td>
                        <td className="iq-td tabular-nums">
                          {vendor.incident_score === null
                            ? '—'
                            : vendor.incident_score.toFixed(1)}
                        </td>
                        <td className="iq-td text-right">
                          <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-emerald-300">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {vendor.overall_score.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="h-3.5 w-3.5" />
            Insights are generated from live vendor, procurement and evaluation
            records. Figures refresh on demand.
          </p>
        </div>
      )}
    </AppLayout>
  )
}