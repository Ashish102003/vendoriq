import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
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
import { IncidentSeverityBadge } from '../../components/incidents/IncidentSeverityBadge'
import { IncidentStatusBadge } from '../../components/incidents/IncidentStatusBadge'
import { useAuth } from '../../context/auth-context'
import { incidentsApi, vendorsApi } from '../../services/api'
import {
  canManageIncidents,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
} from '../../utils/permissions'
import { formatDate } from '../../utils/format'
import { isOverdue } from '../../utils/incidents'
import { cn } from '../../utils/cn'
import { input } from '../../styles/classes'
import type {
  IncidentSortField,
  IncidentSeverity,
  IncidentStatus,
  VendorListItem,
} from '../../types'

const SORTABLE_COLUMNS: { key: IncidentSortField; label: string }[] = [
  { key: 'impact_score', label: 'Impact' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'reported_date', label: 'Reported' },
]

const PAGE_SIZE = 10

interface PageData {
  items: import('../../types').IncidentListItem[]
  total: number
  total_pages: number
}

export function IncidentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleName = user?.role.name ?? ''
  const canAdd = canManageIncidents(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [stats, setStats] = useState({
    total_incidents: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    overdue: 0,
    average_impact_score: null as number | null,
  })

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [vendorId, setVendorId] = useState<number | ''>(() => {
    const v = searchParams.get('vendor_id')
    return v ? Number(v) : ''
  })
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<IncidentSortField>('reported_date')
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
    incidentsApi
      .statistics()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    incidentsApi
      .list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        vendor_id: vendorId === '' ? undefined : vendorId,
        severity: severityFilter === '' ? undefined : severityFilter,
        incident_status: statusFilter === '' ? undefined : statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
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
        const message = err instanceof Error ? err.message : 'Failed to load incidents'
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
    vendorId,
    severityFilter,
    statusFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    reloadKey,
  ])

  const currentItems = pageData?.items ?? []
  const hasFilters =
    debouncedSearch !== '' ||
    vendorId !== '' ||
    severityFilter !== '' ||
    statusFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== ''

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setVendorId('')
    setSeverityFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
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
        label: 'Total Incidents',
        value: stats.total_incidents,
        className: 'text-slate-100',
      },
      { label: 'Open', value: stats.open, className: 'text-blue-400' },
      {
        label: 'In Progress',
        value: stats.in_progress,
        className: 'text-amber-300',
      },
      { label: 'Critical', value: stats.critical, className: 'text-red-400' },
      { label: 'Overdue', value: stats.overdue, className: 'text-orange-400' },
    ],
    [stats],
  )

  function toggleSort(key: IncidentSortField) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder(key === 'reported_date' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function renderSortableHeader({
    column,
    className,
  }: {
    column: { key: IncidentSortField; label: string }
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
    <AppLayout title="Incidents">
      <PageHeader
        title="Incident Management"
        subtitle="Track, manage, and resolve vendor-related operational issues."
        actions={
          canAdd ? (
            <Button onClick={() => navigate('/incidents/new')}>
              <Plus className="h-4 w-4" />
              Report Incident
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
              placeholder="Search incidents..."
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
              className={cn(input, 'max-w-44')}
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
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as IncidentSeverity | '')
                setPage(1)
              }}
              className={cn(input, 'max-w-32')}
              aria-label="Filter by severity"
            >
              <option value="">All severities</option>
              {INCIDENT_SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {INCIDENT_SEVERITY_LABELS[value]}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as IncidentStatus | '')
                setPage(1)
              }}
              className={cn(input, 'max-w-36')}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {INCIDENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INCIDENT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className={cn(input, 'max-w-40')}
              aria-label="Reported from"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className={cn(input, 'max-w-40')}
              aria-label="Reported to"
            />
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
            title="No incidents found"
            message={
              hasFilters
                ? 'Try adjusting or clearing the search and filters.'
                : 'Vendor-related issues and operational incidents will appear here.'
            }
            actions={
              canAdd && !hasFilters ? (
                <Button onClick={() => navigate('/incidents/new')}>
                  <Plus className="h-4 w-4" />
                  Report Incident
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
                    {renderSortableHeader({ column: SORTABLE_COLUMNS[3] })}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentItems.map((incident) => (
                    <tr
                      key={incident.id}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-mono text-xs text-slate-200">
                              {incident.incident_number}
                            </p>
                            <p className="mt-0.5 max-w-56 truncate text-xs text-slate-500">
                              {incident.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {incident.vendor.company_name}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                        {incident.impact_score}
                      </td>
                      <td className="px-4 py-3.5">
                        <IncidentSeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <IncidentStatusBadge status={incident.status} />
                          {isOverdue(incident.status, incident.due_date) && (
                            <span className="text-xs font-medium text-red-400">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {formatDate(incident.reported_date)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/incidents/${incident.id}`}
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
              label="incidents"
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}