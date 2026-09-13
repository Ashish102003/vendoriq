import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Search,
  X,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Pagination } from '../../components/common/Pagination'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { TableSkeleton } from '../../components/common/TableSkeleton'
import { PerformanceClassificationBadge } from '../../components/performance/PerformanceClassificationBadge'
import { vendorPerformanceApi } from '../../services/api'
import {
  PERFORMANCE_CLASSIFICATIONS,
  PERFORMANCE_CLASSIFICATION_LABELS,
} from '../../utils/permissions'
import { cn } from '../../utils/cn'
import { input } from '../../styles/classes'
import type {
  VendorPerformanceClassification,
  VendorPerformanceListItem,
  VendorPerformanceSortField,
} from '../../types'

const SORTABLE_COLUMNS: { key: VendorPerformanceSortField; label: string }[] = [
  { key: 'overall_score', label: 'Overall Score' },
  { key: 'delivery_score', label: 'Delivery' },
  { key: 'quality_score', label: 'Quality' },
  { key: 'incident_score', label: 'Incidents' },
  { key: 'data_confidence', label: 'Data Confidence' },
]

const PAGE_SIZE = 10

interface PageData {
  items: VendorPerformanceListItem[]
  total: number
  total_pages: number
}

function scoreCell(value: number | null): React.ReactNode {
  return value === null ? (
    <span className="text-slate-500">—</span>
  ) : (
    <span className="tabular-nums text-slate-200">{value}</span>
  )
}

export function VendorPerformancePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total_vendors: 0,
    excellent: 0,
    requiring_attention: 0,
    limited_data: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<
    VendorPerformanceClassification | ''
  >('')
  const [sortBy, setSortBy] = useState<VendorPerformanceSortField>('overall_score')
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
    vendorPerformanceApi
      .statistics()
      .then((data) => {
        if (active) {
          setStats({
            total_vendors: data.total_vendors,
            excellent: data.excellent,
            requiring_attention: data.requiring_attention,
            limited_data: data.limited_data,
          })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    vendorPerformanceApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        classification: classificationFilter === '' ? undefined : classificationFilter,
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
        const message = err instanceof Error ? err.message : 'Failed to load vendor performance'
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
  }, [
    page,
    debouncedSearch,
    classificationFilter,
    sortBy,
    sortOrder,
    reloadKey,
  ])

  const currentItems = pageData?.items ?? []
  const hasFilters = debouncedSearch !== '' || classificationFilter !== ''

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setClassificationFilter('')
    setPage(1)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const statCards = useMemo(
    () => [
      {
        label: 'Total Vendors',
        value: stats.total_vendors,
        className: 'text-slate-100',
      },
      {
        label: 'Excellent Vendors',
        value: stats.excellent,
        className: 'text-emerald-400',
      },
      {
        label: 'Vendors Requiring Attention',
        value: stats.requiring_attention,
        className: 'text-red-400',
      },
      {
        label: 'Limited Data Vendors',
        value: stats.limited_data,
        className: 'text-amber-300',
      },
    ],
    [stats],
  )

  function toggleSort(key: VendorPerformanceSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder(key === 'vendor_name' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: VendorPerformanceSortField; label: string }
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
    <AppLayout title="Vendor Performance">
      <PageHeader
        title="Vendor Performance"
        subtitle="Analyze vendor performance using delivery, quality, and operational incident data."
      />

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
        {statCards.map((item) => (
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
              placeholder="Search vendors by name or code..."
              className={cn(input, 'w-full pl-9')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classificationFilter}
              onChange={(e) => {
                setClassificationFilter(
                  e.target.value as VendorPerformanceClassification | '',
                )
                setPage(1)
              }}
              className={cn(input, 'max-w-44')}
              aria-label="Filter by classification"
            >
              <option value="">All classifications</option>
              {PERFORMANCE_CLASSIFICATIONS.map((value) => (
                <option key={value} value={value}>
                  {PERFORMANCE_CLASSIFICATION_LABELS[value]}
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
                : 'Add vendors to begin tracking performance.'
            }
            actions={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700/60"
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
                <thead className="border-b border-slate-800 bg-slate-800/30">
                  <tr>
                    {renderSortableHeader({
                      column: { key: 'vendor_name', label: 'Vendor' },
                    })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[0], className: 'text-right' })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[1], className: 'text-right' })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[2], className: 'text-right' })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[3], className: 'text-right' })}
                    <th className="px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Classification
                      </span>
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[4], className: 'text-right' })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((item) => (
                    <tr
                      key={item.vendor_id}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => navigate(`/vendors/${item.vendor_id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                            <BarChart3 className="h-4 w-4" />
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
                      <td className="px-4 py-3.5 text-right font-medium">
                        {scoreCell(item.overall_score)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {scoreCell(item.delivery_score)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {scoreCell(item.quality_score)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {scoreCell(item.incident_score)}
                      </td>
                      <td className="px-4 py-3.5">
                        <PerformanceClassificationBadge
                          classification={item.classification}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="tabular-nums text-slate-200">
                          {item.data_confidence}
                        </span>
                        {item.limited_data && (
                          <p className="mt-0.5 text-xs font-medium text-amber-300">
                            Limited data
                          </p>
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