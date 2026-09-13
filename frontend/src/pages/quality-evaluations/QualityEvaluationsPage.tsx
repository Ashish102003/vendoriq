import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardCheck,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/common/Pagination'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { TableSkeleton } from '../../components/common/TableSkeleton'
import { QualityStatusBadge } from '../../components/quality-evaluations/QualityStatusBadge'
import { useAuth } from '../../context/auth-context'
import { qualityEvaluationsApi, vendorsApi } from '../../services/api'
import {
  canManageQualityEvaluations,
  QUALITY_STATUSES,
  QUALITY_STATUS_LABELS,
} from '../../utils/permissions'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'
import { input } from '../../styles/classes'
import type {
  QualityEvaluationSortField,
  QualityStatus,
  VendorListItem,
} from '../../types'

const SORTABLE_COLUMNS: { key: QualityEvaluationSortField; label: string }[] = [
  { key: 'quality_score', label: 'Score' },
  { key: 'quality_status', label: 'Status' },
  { key: 'evaluation_date', label: 'Date' },
]

const PAGE_SIZE = 10

interface PageData {
  items: import('../../types').QualityEvaluationListItem[]
  total: number
  total_pages: number
}

function referenceLabel(item: import('../../types').QualityEvaluationListItem): string {
  if (item.purchase_order) return item.purchase_order.order_number
  if (item.contract) return item.contract.contract_number
  return 'General Evaluation'
}

export function QualityEvaluationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleName = user?.role.name ?? ''
  const canAdd = canManageQualityEvaluations(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [stats, setStats] = useState({
    total_evaluations: 0,
    excellent: 0,
    good: 0,
    acceptable: 0,
    poor: 0,
    critical: 0,
    average_quality_score: null as number | null,
    total_defects: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendorId, setVendorId] = useState<number | ''>(() => {
    const v = searchParams.get('vendor_id')
    return v ? Number(v) : ''
  })
  const [statusFilter, setStatusFilter] = useState<QualityStatus | ''>('')
  const [sortBy, setSortBy] = useState<QualityEvaluationSortField>('evaluation_date')
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
    vendorsApi
      .list({ page_size: 100 })
      .then((data) => {
        if (active) setVendors(data.items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    qualityEvaluationsApi
      .statistics()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [error])

  useEffect(() => {
    let active = true
    qualityEvaluationsApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        vendor_id: vendorId === '' ? undefined : vendorId,
        quality_status: statusFilter === '' ? undefined : statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      .then((data) => {
        if (!active) return
        if (data.total_pages > 0 && data.total_pages < page) {
          setPage(Math.max(1, data.total_pages))
          return
        }
        setPageData({
          items: data.items,
          total: data.total,
          total_pages: data.total_pages,
        })
        setTotal(data.total)
        setTotalPages(data.total_pages)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Failed to load quality evaluations'
        setError(message)
        setPageData(null)
        setTotal(0)
        setTotalPages(0)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, debouncedSearch, vendorId, statusFilter, sortBy, sortOrder, reloadKey])

  const currentItems = pageData?.items ?? []
  const hasFilters = debouncedSearch !== '' || vendorId !== '' || statusFilter !== ''

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setVendorId('')
    setStatusFilter('')
    setPage(1)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const sortedStats = useMemo(
    () => [
      {
        label: 'Total Evaluations',
        value: stats.total_evaluations,
        className: 'text-slate-100',
      },
      {
        label: 'Average Quality Score',
        value: stats.average_quality_score !== null ? stats.average_quality_score : '—',
        className: 'text-indigo-300',
      },
      { label: 'Excellent', value: stats.excellent, className: 'text-emerald-400' },
      {
        label: 'Poor + Critical',
        value: stats.poor + stats.critical,
        className: 'text-red-400',
      },
      { label: 'Total Defects', value: stats.total_defects, className: 'text-amber-300' },
    ],
    [stats],
  )

  function toggleSort(key: QualityEvaluationSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder(key === 'evaluation_date' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: QualityEvaluationSortField; label: string }
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
    <AppLayout title="Quality Evaluations">
      <PageHeader
        title="Quality Evaluations"
        subtitle="Monitor and record the quality of products and services delivered by vendors."
        actions={
          canAdd ? (
            <Button onClick={() => navigate('/quality-evaluations/new')}>
              <Plus className="h-4 w-4" />
              Record Evaluation
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:gap-6">
        {sortedStats.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-5"
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', item.className)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032]">
        <div className="flex flex-col gap-3 border-b border-slate-800/70 p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search quality evaluations..."
              className={cn(input, 'w-full pl-9')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value === '' ? '' : Number(e.target.value))
                setPage(1)
              }}
              className={cn(input, 'max-w-52')}
              aria-label="Filter by vendor"
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.company_name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as QualityStatus | '')
                setPage(1)
              }}
              className={cn(input, 'max-w-44')}
              aria-label="Filter by quality status"
            >
              <option value="">All statuses</option>
              {QUALITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {QUALITY_STATUS_LABELS[value]}
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
            title="No quality evaluations found"
            message={
              hasFilters
                ? 'Try adjusting or clearing the search and filters.'
                : 'Record a quality evaluation to begin monitoring vendor quality performance.'
            }
            actions={
              canAdd && !hasFilters ? (
                <Button onClick={() => navigate('/quality-evaluations/new')}>
                  <Plus className="h-4 w-4" />
                  Record Evaluation
                </Button>
              ) : hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-800/30">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Vendor
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[0], className: 'text-right' })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[1] })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[2] })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Defects
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((evaluation) => (
                    <tr
                      key={evaluation.id}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => navigate(`/quality-evaluations/${evaluation.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-800/60 text-slate-400">
                            <ClipboardCheck className="h-4 w-4" />
                          </span>
                          <span className="font-mono text-xs text-slate-200">
                            {referenceLabel(evaluation)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {evaluation.vendor.company_name}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                        {evaluation.quality_score}
                      </td>
                      <td className="px-4 py-3.5">
                        <QualityStatusBadge status={evaluation.quality_status} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {formatDate(evaluation.evaluation_date)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                        {evaluation.defect_count}/{evaluation.total_items}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/quality-evaluations/${evaluation.id}`}
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
              label="quality evaluations"
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}