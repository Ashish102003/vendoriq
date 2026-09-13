import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Package,
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
import { DeliveryStatusBadge } from '../../components/purchase-orders/DeliveryStatusBadge'
import { PurchaseOrderStatusBadge } from '../../components/purchase-orders/PurchaseOrderStatusBadge'
import { useAuth } from '../../context/auth-context'
import { purchaseOrdersApi, vendorsApi } from '../../services/api'
import {
  canManagePurchaseOrders,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
} from '../../utils/permissions'
import { formatCurrency, formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'
import { input } from '../../styles/classes'
import type {
  PurchaseOrderSortField,
  PurchaseOrderStatus,
  VendorListItem,
} from '../../types'

const SORTABLE_COLUMNS: { key: PurchaseOrderSortField; label: string }[] = [
  { key: 'title', label: 'Order' },
  { key: 'order_number', label: 'Number' },
  { key: 'order_value', label: 'Value' },
  { key: 'expected_delivery_date', label: 'Expected' },
  { key: 'status', label: 'Status' },
]

const PAGE_SIZE = 10

interface PageData {
  items: import('../../types').PurchaseOrderListItem[]
  total: number
  total_pages: number
}

export function PurchaseOrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleName = user?.role.name ?? ''
  const canAdd = canManagePurchaseOrders(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [stats, setStats] = useState({
    total_orders: 0,
    draft_orders: 0,
    issued_orders: 0,
    in_progress_orders: 0,
    delivered_orders: 0,
    partially_delivered_orders: 0,
    cancelled_orders: 0,
    closed_orders: 0,
    total_order_value: '0',
    on_time_deliveries: 0,
    delayed_deliveries: 0,
    pending_deliveries: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendorId, setVendorId] = useState<number | ''>(() => {
    const v = searchParams.get('vendor_id')
    return v ? Number(v) : ''
  })
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  const [sortBy, setSortBy] = useState<PurchaseOrderSortField>('created_at')
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
    purchaseOrdersApi
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
    purchaseOrdersApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        vendor_id: vendorId === '' ? undefined : vendorId,
        status: statusFilter === '' ? undefined : statusFilter,
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
        const message = err instanceof Error ? err.message : 'Failed to load purchase orders'
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
      { label: 'Total', value: stats.total_orders, className: 'text-slate-100' },
      { label: 'Issued', value: stats.issued_orders, className: 'text-sky-300' },
      { label: 'In Progress', value: stats.in_progress_orders, className: 'text-blue-400' },
      { label: 'Delivered', value: stats.delivered_orders, className: 'text-emerald-400' },
      { label: 'Delayed', value: stats.delayed_deliveries, className: 'text-red-400' },
      {
        label: 'Total Order Value',
        value: formatCurrency(stats.total_order_value),
        className: 'text-indigo-300',
      },
    ],
    [stats],
  )

  function toggleSort(key: PurchaseOrderSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder(key === 'created_at' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: PurchaseOrderSortField; label: string }
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
    <AppLayout title="Purchase Orders">
      <PageHeader
        title="Purchase Orders"
        subtitle="Track vendor orders and delivery commitments."
        actions={
          canAdd ? (
            <Button onClick={() => navigate('/purchase-orders/new')}>
              <Plus className="h-4 w-4" />
              Add Purchase Order
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
              placeholder="Search by order number or title…"
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
                setStatusFilter(e.target.value as PurchaseOrderStatus | '')
                setPage(1)
              }}
              className={cn(input, 'max-w-44')}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {PURCHASE_ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PURCHASE_ORDER_STATUS_LABELS[value]}
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
            title="No purchase orders found"
            message={
              hasFilters
                ? 'Try adjusting or clearing the search and filters.'
                : 'Create a purchase order to begin tracking vendor delivery commitments.'
            }
            actions={
              canAdd && !hasFilters ? (
                <Button onClick={() => navigate('/purchase-orders/new')}>
                  <Plus className="h-4 w-4" />
                  Add Purchase Order
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
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[0] })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[1] })}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Vendor
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[2], className: 'text-right' })}
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[3] })}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Delivery
                    </th>
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[4] })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((po) => (
                    <tr
                      key={po.id}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-800/60 text-slate-400">
                            <Package className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-100">
                            {po.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        {po.order_number}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {po.vendor.company_name}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                        {formatCurrency(po.order_value)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {formatDate(po.expected_delivery_date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <DeliveryStatusBadge status={po.delivery_status} />
                          {po.delay_days !== null && po.delay_days > 0 && (
                            <span className="text-xs text-red-400">
                              +{po.delay_days}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <PurchaseOrderStatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/purchase-orders/${po.id}`}
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
              label="purchase orders"
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}