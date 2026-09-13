import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Gauge,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Pagination } from '../../components/common/Pagination'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { TableSkeleton } from '../../components/common/TableSkeleton'
import { StatCard } from '../../components/common/StatCard'
import { RiskLevelBadge } from '../../components/risk/RiskLevelBadge'
import { RiskScoreIndicator } from '../../components/risk/RiskScoreIndicator'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { vendorRiskApi } from '../../services/api'
import {
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
} from '../../utils/risk'
import { cn } from '../../utils/cn'
import type {
  VendorRiskListItem,
  VendorRiskSortField,
  RiskLevel,
  ModelInfo,
  TrainingResult,
} from '../../types'

const inputClass =
  'h-9 rounded-md border border-slate-700/80 bg-slate-800/40 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'

const SORTABLE_COLUMNS: { key: VendorRiskSortField; label: string }[] = [
  { key: 'risk_score', label: 'Risk Score' },
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'performance_score', label: 'Performance' },
]

const PAGE_SIZE = 10

interface PageData {
  items: VendorRiskListItem[]
  total: number
  total_pages: number
}

function methodLabel(method: string): string {
  if (method === 'RULE_BASED') return 'Rules'
  if (method === 'ML_BASED') return 'ML'
  if (method === 'HYBRID') return 'Hybrid'
  return method
}

function methodClass(method: string): string {
  if (method === 'RULE_BASED') return 'bg-slate-500/10 text-slate-300 border-slate-500/25'
  if (method === 'ML_BASED') return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
  if (method === 'HYBRID') return 'bg-violet-500/10 text-violet-300 border-violet-500/25'
  return 'bg-slate-500/10 text-slate-300 border-slate-500/25'
}

export function VendorRiskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role.name === 'Admin'
  const { showToast } = useToast()

  const [stats, setStats] = useState({
    total_vendors: 0,
    average_risk_score: null as number | null,
    very_low_risk: 0,
    low_risk: 0,
    medium_risk: 0,
    high_risk: 0,
    critical_risk: 0,
    high_confidence_predictions: 0,
    low_confidence_predictions: 0,
    no_data: 0,
  })

  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [training, setTraining] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [riskLevelFilter, setRiskLevelFilter] = useState<RiskLevel | ''>('')
  const [sortBy, setSortBy] = useState<VendorRiskSortField>('risk_score')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    vendorRiskApi
      .statistics()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    vendorRiskApi
      .modelInfo()
      .then((data) => {
        if (active) setModelInfo(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    vendorRiskApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        risk_level: riskLevelFilter === '' ? undefined : riskLevelFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      .then((data) => {
        if (!active) return
        if (data.total_pages > 0 && data.total_pages < page) {
          setPage(Math.max(1, data.total_pages))
          return
        }
        setPageData({ items: data.items, total: data.total, total_pages: data.total_pages })
        setTotal(data.total)
        setTotalPages(data.total_pages)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load risk data')
        setPageData(null)
        setTotal(0)
        setTotalPages(0)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, debouncedSearch, riskLevelFilter, sortBy, sortOrder, reloadKey])

  async function handleTrain() {
    setTraining(true)
    try {
      const result: TrainingResult = await vendorRiskApi.train()
      showToast(
        result.trained
          ? `Model trained: ${result.training_records} records`
          : result.message ?? result.status,
        result.trained ? 'success' : 'info',
      )
      setReloadKey((prev) => prev + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Training failed', 'error')
    } finally {
      setTraining(false)
    }
  }

  const currentItems = pageData?.items ?? []
  const hasFilters = debouncedSearch !== '' || riskLevelFilter !== ''

  function clearFilters() {
    setSearchInput('')
    setDebouncedSearch('')
    setRiskLevelFilter('')
    setPage(1)
  }

  function handleRetry() {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  function toggleSort(key: VendorRiskSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder(key === 'risk_score' ? 'asc' : key === 'performance_score' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const distributionBars = useMemo(() => {
    const count = stats.total_vendors
    if (count === 0) return []
    const levels: { key: 'very_low_risk' | 'low_risk' | 'medium_risk' | 'high_risk' | 'critical_risk'; level: RiskLevel }[] = [
      { key: 'very_low_risk', level: 'VERY_LOW' },
      { key: 'low_risk', level: 'LOW' },
      { key: 'medium_risk', level: 'MEDIUM' },
      { key: 'high_risk', level: 'HIGH' },
      { key: 'critical_risk', level: 'CRITICAL' },
    ]
    return levels.map(({ key, level }) => {
      const n: number = stats[key]
      return { level, label: RISK_LEVEL_LABELS[level], count: n, pct: Math.round((n / count) * 100) }
    })
  }, [stats])

  const levelSegmentClass: Record<RiskLevel, string> = {
    VERY_LOW: 'bg-emerald-400',
    LOW: 'bg-green-500',
    MEDIUM: 'bg-amber-400',
    HIGH: 'bg-orange-500',
    CRITICAL: 'bg-red-500',
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: VendorRiskSortField; label: string }
    className?: string
  }) {
    return (
      <th className={cn('px-4 py-3', className)}>
        <button
          type="button"
          onClick={() => toggleSort(column.key)}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-100"
        >
          {column.label}
          {sortBy === column.key ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      </th>
    )
  }

  return (
    <AppLayout title="Risk Center">
      <PageHeader
        title="Risk Center"
        subtitle="Predictive risk scores, levels, confidence, and explainable factors for each vendor."
        actions={
          isAdmin ? (
            <button
              type="button"
              disabled={training}
              onClick={() => void handleTrain()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-lg shadow-indigo-950/40 transition-all hover:bg-indigo-500 hover:shadow-indigo-900/40 disabled:opacity-50"
            >
              {training && <Loader2 className="h-4 w-4 animate-spin" />}
              {training ? 'Training…' : 'Train Model'}
            </button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:gap-6">
        <StatCard
          label="Total Vendors"
          value={stats.total_vendors}
          icon={<Shield className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="Avg Risk Score"
          value={stats.average_risk_score !== null ? stats.average_risk_score : '—'}
          icon={<Gauge className="h-5 w-5" />}
          accent={stats.average_risk_score !== null && stats.average_risk_score > 60 ? 'red' : 'emerald'}
          hint="0–100 scale"
        />
        <StatCard
          label="High + Critical"
          value={stats.high_risk + stats.critical_risk}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="red"
          hint="Requires immediate attention"
        />
        <StatCard
          label="No Data"
          value={stats.no_data}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      {/* Distribution */}
      {stats.total_vendors > 0 && (
        <div className="mt-4 rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Risk Distribution
          </p>
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-800/70">
            {distributionBars.map((bar) =>
              bar.pct > 0 ? (
                <div
                  key={bar.level}
                  className={cn('h-full transition-all', levelSegmentClass[bar.level])}
                  style={{ width: `${bar.pct}%` }}
                  title={`${bar.label}: ${bar.count}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {distributionBars.map((bar) => (
              <span
                key={bar.level}
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  'text-slate-400',
                )}
              >
                <span
                  className={cn('inline-block h-2 w-2 rounded-full', levelSegmentClass[bar.level])}
                />
                {bar.label}: {bar.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Model info */}
      {modelInfo && (
        <div className="mt-4 rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/10">
                <ShieldCheck className="h-4 w-4 text-indigo-300" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ML Model
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {modelInfo.available ? (
                    <>
                      <span className="font-medium text-indigo-300">{modelInfo.model_type}</span>
                      {' · '}
                      Trained on {modelInfo.training_records} records
                      {modelInfo.training_date && ` · ${new Date(modelInfo.training_date).toLocaleDateString()}`}
                    </>
                  ) : (
                    <span className="text-slate-500">Not trained — using rule-based prediction</span>
                  )}
                </p>
              </div>
            </div>
            {modelInfo.available && modelInfo.evaluation_metrics && (
              <div className="hidden sm:flex sm:gap-4">
                {Object.entries(modelInfo.evaluation_metrics).map(([k, v]) => (
                  <div key={k} className="text-right">
                    <p className="text-[10px] uppercase text-slate-500">{k.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-100">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032]">
        <div className="flex flex-col gap-3 border-b border-slate-800/70 p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search vendors by name or code..."
              className={cn(inputClass, 'w-full pl-9')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={riskLevelFilter}
              onChange={(e) => {
                setRiskLevelFilter(e.target.value as RiskLevel | '')
                setPage(1)
              }}
              className={cn(inputClass, 'max-w-44')}
              aria-label="Filter by risk level"
            >
              <option value="">All risk levels</option>
              {RISK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {RISK_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : currentItems.length === 0 ? (
          <EmptyState
            title="No vendors available"
            message={
              hasFilters
                ? 'Try adjusting or clearing the search and filters.'
                : 'Add vendors to begin tracking predictive risk.'
            }
            actions={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/40"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="iq-table-head border-b border-slate-800 bg-slate-800/30">
                  <tr>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[1] })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[0], className: 'text-right' })}
                    <th className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Level
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Method
                      </span>
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[2], className: 'text-right' })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((item) => (
                    <tr
                      key={item.vendor_id}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-white/[0.04]',
                        (item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL') &&
                          'border-l-2 border-l-red-500 bg-red-500/[0.06]',
                      )}
                      onClick={() => navigate(`/vendors/${item.vendor_id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                            <Shield className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-100">
                              {item.vendor_name}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {item.vendor_code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <RiskScoreIndicator score={item.risk_score} />
                      </td>
                      <td className="px-4 py-3.5">
                        <RiskLevelBadge level={item.risk_level} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                            methodClass(item.prediction_method),
                          )}
                        >
                          {methodLabel(item.prediction_method)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium">
                        {item.performance_score !== null ? (
                          <span className="tabular-nums text-slate-100">{item.performance_score}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/vendors/${item.vendor_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={setPage}
              label="vendors"
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}