import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { TableSkeleton } from '../../components/common/TableSkeleton'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/common/Pagination'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { VendorStatusBadge } from '../../components/vendors/VendorStatusBadge'
import { PerformanceClassificationBadge } from '../../components/performance/PerformanceClassificationBadge'
import { RiskLevelBadge } from '../../components/risk/RiskLevelBadge'
import { useAuth } from '../../context/auth-context'
import { vendorsApi, vendorCategoriesApi, vendorPerformanceApi, vendorRiskApi } from '../../services/api'
import { canCreateVendor, VENDOR_STATUSES, VENDOR_STATUS_LABELS } from '../../utils/permissions'
import { cn } from '../../utils/cn'
import type {
  VendorSortField,
  VendorStatus,
  VendorCategoryWithCount,
  VendorPerformanceClassification,
  VendorListItem,
} from '../../types'
import type { RiskLevel } from '../../types'

const inputClass =
  'h-9 rounded-md border border-slate-700/80 bg-slate-800/40 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'

const SORTABLE_COLUMNS: { key: VendorSortField; label: string }[] = [
  { key: 'company_name', label: 'Vendor' },
  { key: 'vendor_code', label: 'Vendor Code' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Vendor Since' },
]

const PAGE_SIZE = 10

interface PageData {
  items: VendorListItem[]
  total: number
  total_pages: number
}

export function VendorListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const roleName = user?.role.name ?? ''
  const canAdd = canCreateVendor(roleName)

  const [categories, setCategories] = useState<VendorCategoryWithCount[]>([])
  const [stats, setStats] = useState({
    total_vendors: 0,
    active_vendors: 0,
    pending_vendors: 0,
    under_review_vendors: 0,
    suspended_vendors: 0,
    terminated_vendors: 0,
    inactive_vendors: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [statusFilter, setStatusFilter] = useState<VendorStatus | ''>('')
  const [activeFilter, setActiveFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<VendorSortField>('company_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [perfByVendor, setPerfByVendor] = useState<Record<number, VendorPerformanceClassification>>({})
  const [riskByVendor, setRiskByVendor] = useState<Record<number, RiskLevel | null>>({})

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    vendorCategoriesApi
      .list()
      .then((categoriesData) => {
        if (active) setCategories(categoriesData)
      })
      .catch(() => {
        // stats strip and filter dropdown degrade gracefully
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    vendorsApi
      .statistics()
      .then((statsData) => {
        if (active) setStats(statsData)
      })
      .catch(() => {
        // stats strip degrades gracefully
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    vendorsApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        category_id: categoryId === '' ? undefined : categoryId,
        status: statusFilter === '' ? undefined : statusFilter,
        is_active: activeFilter === '' ? undefined : activeFilter === 'active',
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
        const message = err instanceof Error ? err.message : 'Failed to load vendors'
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
  }, [page, debouncedSearch, categoryId, statusFilter, activeFilter, sortBy, sortOrder, reloadKey])

  useEffect(() => {
    let active = true
    vendorPerformanceApi
      .list({ page_size: 200 })
      .then((data) => {
        if (!active) return
        const map: Record<number, VendorPerformanceClassification> = {}
        for (const item of data.items) map[item.vendor_id] = item.classification
        setPerfByVendor(map)
      })
      .catch(() => {})
    vendorRiskApi
      .list({ page_size: 200 })
      .then((data) => {
        if (!active) return
        const map: Record<number, RiskLevel | null> = {}
        for (const item of data.items) map[item.vendor_id] = item.risk_level
        setRiskByVendor(map)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [reloadKey])

  const currentItems = pageData?.items ?? []
  const hasFilters =
    debouncedSearch !== '' ||
    categoryId !== '' ||
    statusFilter !== '' ||
    activeFilter !== ''

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setCategoryId('')
    setStatusFilter('')
    setActiveFilter('')
    setPage(1)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const sortedStats = useMemo(
    () => [
      { label: 'Total', value: stats.total_vendors, className: 'text-slate-100' },
      { label: 'Active', value: stats.active_vendors, className: 'text-emerald-400' },
      { label: 'Pending', value: stats.pending_vendors, className: 'text-amber-300' },
      { label: 'Under Review', value: stats.under_review_vendors, className: 'text-sky-300' },
      { label: 'Suspended', value: stats.suspended_vendors, className: 'text-orange-400' },
      { label: 'Terminated', value: stats.terminated_vendors, className: 'text-red-400' },
    ],
    [stats],
  )

  function toggleSort(key: VendorSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
    setPage(1)
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: VendorSortField; label: string }
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
    <AppLayout title="Vendors">
      <PageHeader
        title="Vendors"
        subtitle="Manage the organizations your company purchases from."
        actions={
          canAdd ? (
            <Button onClick={() => navigate('/vendors/new')}>
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6 xl:gap-6">
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
              placeholder="Search by company, code, contact, or email…"
              className={cn(inputClass, 'w-full pl-9')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                setPage(1)
              }}
              className={cn(inputClass, 'max-w-44')}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as VendorStatus | '')
                setPage(1)
              }}
              className={cn(inputClass, 'max-w-40')}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {VENDOR_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {VENDOR_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value)
                setPage(1)
              }}
              className={cn(inputClass, 'max-w-36')}
              aria-label="Filter by activity"
            >
              <option value="">Active + inactive</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
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
            title={hasFilters ? 'No vendors match your filters' : 'No vendors yet'}
            message={
              hasFilters
                ? 'Try adjusting or clearing the search and filters.'
                : 'Add your first vendor to start building your vendor directory.'
            }
            actions={
              canAdd && !hasFilters ? (
                <Button onClick={() => navigate('/vendors/new')}>
                  <Plus className="h-4 w-4" />
                  Add Vendor
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
              <table className="iq-table-body w-full text-left text-sm">
                <thead className="iq-table-head border-b border-slate-800 bg-slate-800/30">
                  <tr>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[0] })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[1] })}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Category
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Contact
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[2] })}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Performance
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Risk
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[3], className: 'text-right' })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="iq-row-hover cursor-pointer"
                      onClick={() => navigate(`/vendors/${vendor.id}`)}
                    >
                      <td className="iq-td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-400">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-100">
                            {vendor.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="iq-td font-mono text-xs text-slate-500">
                        {vendor.vendor_code}
                      </td>
                      <td className="iq-td text-slate-400">
                        {vendor.category.name}
                      </td>
                      <td className="iq-td">
                        <p className="text-slate-200">{vendor.contact_person ?? '—'}</p>
                        {vendor.email && (
                          <p className="text-xs text-slate-500">{vendor.email}</p>
                        )}
                      </td>
                      <td className="iq-td">
                        <VendorStatusBadge
                          status={vendor.status}
                          inactive={!vendor.is_active}
                        />
                      </td>
                      <td className="iq-td">
                        {perfByVendor[vendor.id] ? (
                          <PerformanceClassificationBadge classification={perfByVendor[vendor.id]} />
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="iq-td">
                        {riskByVendor[vendor.id] !== undefined ? (
                          <RiskLevelBadge level={riskByVendor[vendor.id]} />
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="iq-td text-right text-xs text-slate-500">
                        {vendor.vendor_since ??
                          new Date(vendor.created_at).toLocaleDateString()}
                      </td>
                      <td className="iq-td text-right">
                        <Link
                          to={`/vendors/${vendor.id}`}
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
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}