import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Star,
  UserRound,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/common/Modal'
import { ErrorState } from '../../components/common/ErrorState'
import { VendorStatusBadge } from '../../components/vendors/VendorStatusBadge'
import { PerformanceClassificationBadge } from '../../components/performance/PerformanceClassificationBadge'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { vendorsApi, vendorOperationsApi, vendorQualityApi, vendorIncidentsApi, vendorPerformanceApi, vendorRiskApi } from '../../services/api'
import { canCreateVendor, canManageVendorStatus, VENDOR_STATUSES, VENDOR_STATUS_LABELS } from '../../utils/permissions'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import { TrendChart } from '../../components/analytics/TrendChart'
import { EmptyChart } from '../../components/analytics/EmptyChart'
import { TREND_COLORS } from '../../components/analytics/chartTheme'
import { analyticsApi } from '../../services/api'
import type { VendorDetail, VendorIncidentSummary, VendorOperationsSummary, VendorPerformanceDetail, VendorQualitySummary, VendorStatus, DeliveryTrend, QualityTrend, IncidentTrend, PredictiveRisk } from '../../types'
import { RiskLevelBadge } from '../../components/risk/RiskLevelBadge'
import { RiskScoreIndicator } from '../../components/risk/RiskScoreIndicator'
import { RISK_CONFIDENCE_LABELS, RISK_TREND_LABELS, RISK_TREND_STYLES, riskScoreColor } from '../../utils/risk'

function DecisionVerdict({
  performance,
  risk,
}: {
  performance: VendorPerformanceDetail | null
  risk: PredictiveRisk | null
}) {
  const classification = performance?.classification
  const riskLevel = risk?.risk_level

  let verdict: { label: string; detail: string; tone: string } = {
    label: 'Insufficient data',
    detail: 'Not enough performance or risk data to advise.',
    tone: 'border-slate-700 bg-slate-800/50 text-slate-300',
  }

  if (riskLevel === 'CRITICAL' || classification === 'CRITICAL') {
    verdict = {
      label: 'Critical review',
      detail: 'Immediate engagement required. Validate risk drivers.',
      tone: 'border-red-500/25 bg-red-500/10 text-red-300',
    }
  } else if (riskLevel === 'HIGH' || classification === 'POOR') {
    verdict = {
      label: 'Priority review',
      detail: 'Weak signals present. Plan a corrective action review.',
      tone: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
    }
  } else if (riskLevel === 'MEDIUM' || classification === 'AVERAGE') {
    verdict = {
      label: 'Monitor',
      detail: 'Performance is acceptable but watch key indicators.',
      tone: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    }
  } else if (performance?.classification && risk?.risk_score !== undefined && risk.risk_score !== null) {
    verdict = {
      label: 'Healthy partner',
      detail: 'Low risk and solid performance. Standard oversight.',
      tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    }
  }

  return (
    <div className={`mt-2 rounded-lg border p-3 ${verdict.tone}`}>
      <p className="text-sm font-semibold">{verdict.label}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-80">{verdict.detail}</p>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-7">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-100">{value || '—'}</dd>
    </div>
  )
}

function MiniStat({
  label,
  value,
  valueClass,
  hint,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
  hint?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', valueClass ?? 'text-slate-100')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

const softLinkClass =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/40 hover:text-slate-100'

export function VendorDetailPage() {
  const { vendorId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const canEdit = canCreateVendor(roleName)
  const canChangeStatus = canManageVendorStatus(roleName)

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [operations, setOperations] = useState<VendorOperationsSummary | null>(null)
  const [quality, setQuality] = useState<VendorQualitySummary | null>(null)
  const [incidents, setIncidents] = useState<VendorIncidentSummary | null>(null)
  const [performance, setPerformance] = useState<VendorPerformanceDetail | null>(null)
  const [risk, setRisk] = useState<PredictiveRisk | null>(null)
  const [deliveryTrend, setDeliveryTrend] = useState<DeliveryTrend | null>(null)
  const [qualityTrend, setQualityTrend] = useState<QualityTrend | null>(null)
  const [incidentTrend, setIncidentTrend] = useState<IncidentTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<VendorStatus>('ACTIVE')
  const [deactivating, setDeactivating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    vendorsApi
      .get(Number(vendorId))
      .then((data) => {
        if (active) {
          setVendor(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load vendor')
          setVendor(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    vendorOperationsApi
      .getSummary(Number(vendorId))
      .then((data) => {
        if (active) setOperations(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    vendorQualityApi
      .getSummary(Number(vendorId))
      .then((data) => {
        if (active) setQuality(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    vendorIncidentsApi
      .getSummary(Number(vendorId))
      .then((data) => {
        if (active) setIncidents(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    vendorPerformanceApi
      .get(Number(vendorId))
      .then((data) => {
        if (active) setPerformance(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    vendorRiskApi
      .getVendorRisk(Number(vendorId))
      .then((data) => {
        if (active) setRisk(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  useEffect(() => {
    let active = true
    const vendorScoped = { vendor_id: Number(vendorId) }
    analyticsApi
      .deliveryTrend(vendorScoped)
      .then((data) => {
        if (active) setDeliveryTrend(data)
      })
      .catch(() => {})
    analyticsApi
      .qualityTrend(vendorScoped)
      .then((data) => {
        if (active) setQualityTrend(data)
      })
      .catch(() => {})
    analyticsApi
      .incidentTrend(vendorScoped)
      .then((data) => {
        if (active) setIncidentTrend(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [vendorId, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  async function applyStatus(nextStatus: VendorStatus, nextActive?: boolean) {
    if (vendor == null) return
    setSaving(true)
    try {
      const updated = await vendorsApi.updateStatus(vendor.id, {
        status: nextStatus,
        ...(nextActive !== undefined ? { is_active: nextActive } : {}),
      })
      setVendor(updated)
      setStatusModalOpen(false)
      showToast(
        nextActive === false
          ? 'Vendor deactivated'
          : 'Vendor status updated',
        'success',
      )
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update status',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Vendors">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span className="text-sm">Loading vendor…</span>
        </div>
      </AppLayout>
    )
  }

  if (error || vendor == null) {
    return (
      <AppLayout title="Vendors">
        <ErrorState
          message={error ?? 'Vendor not found'}
          onRetry={handleRetry}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Vendors">
      <Link
        to="/vendors"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to vendors
      </Link>

      <PageHeader
        title={vendor.company_name}
        subtitle={`${vendor.vendor_code} · ${vendor.category.name}`}
        actions={
          <>
            {canChangeStatus && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNewStatus(vendor.status)
                  setStatusModalOpen(true)
                }}
              >
                Change Status
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => navigate(`/vendors/${vendor.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit Vendor
              </Button>
            )}
          </>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <VendorStatusBadge status={vendor.status} inactive={!vendor.is_active} />
        {vendor.vendor_since && (
          <span className="text-sm text-slate-500">
            Vendor since {new Date(vendor.vendor_since).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <div className="iq-card-elevated px-6 py-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Performance
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums text-slate-100">
                {performance?.overall_score ?? '—'}
              </p>
              {performance && (
                <div className="mt-1">
                  <PerformanceClassificationBadge classification={performance.classification} />
                </div>
              )}
            </div>
            <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
              <span
                className="block h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, performance?.overall_score ?? 0)}%` }}
              />
            </span>
          </div>
          {performance?.limited_data && (
            <p className="mt-1.5 text-xs font-medium text-amber-300">Limited data</p>
          )}
        </div>

        <div className="iq-card-elevated px-6 py-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Predictive Risk
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: risk?.risk_score === null || risk?.risk_score === undefined ? '#64748b' : riskScoreColor(risk.risk_score) }}
              >
                {risk?.risk_score ?? '—'}
              </p>
              <div className="mt-1">
                <RiskLevelBadge level={risk?.risk_level ?? null} />
              </div>
            </div>
          </div>
          {risk && (
            <p className={`mt-1.5 text-xs font-medium ${RISK_TREND_STYLES[risk.risk_trend]}`}>
              Trend: {RISK_TREND_LABELS[risk.risk_trend]}
            </p>
          )}
        </div>

        <div className="iq-card-elevated px-6 py-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Contracts &amp; Orders
          </p>
          <div className="mt-2 space-y-1.5">
            <p className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Active contracts</span>
              <span className="font-semibold tabular-nums text-slate-100">
                {operations?.active_contracts ?? 0}
              </span>
            </p>
            <p className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Active orders</span>
              <span className="font-semibold tabular-nums text-slate-100">
                {operations?.active_orders ?? 0}
              </span>
            </p>
            <p className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Delayed deliveries</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  (operations?.delayed_orders ?? 0) > 0 ? 'text-red-400' : 'text-slate-100',
                )}
              >
                {operations?.delayed_orders ?? 0}
              </span>
            </p>
          </div>
        </div>

        <div className="iq-card-elevated px-6 py-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
            Decision
          </p>
          <DecisionVerdict performance={performance} risk={risk} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Overview">
            <dl>
              <p className="text-sm leading-relaxed text-slate-400">
                Vendor record for <span className="font-medium text-slate-100">{vendor.company_name}</span>, a{' '}
                {vendor.category.name.toLowerCase()} supplier with vendor code{' '}
                <span className="font-mono">{vendor.vendor_code}</span>.
              </p>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Category" value={vendor.category.name} />
                <DetailRow label="Status" value={VENDOR_STATUS_LABELS[vendor.status]} />
                <DetailRow label="Account status" value={vendor.is_active ? 'Active' : 'Inactive'} />
                <DetailRow label="Vendor since" value={vendor.vendor_since} />
              </div>
            </dl>
          </Section>

          <Section title="Contact">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 py-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">Contact person</dt>
                  <dd className="mt-0.5 text-sm text-slate-100">{vendor.contact_person ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 py-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">Phone</dt>
                  <dd className="mt-0.5 text-sm text-slate-100">{vendor.phone ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 py-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">Email</dt>
                  <dd className="mt-0.5 text-sm text-slate-100">
                    {vendor.email ? (
                      <a href={`mailto:${vendor.email}`} className="text-indigo-300 hover:text-indigo-200">
                        {vendor.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5 py-2">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">Website</dt>
                  <dd className="mt-0.5 text-sm text-slate-100">
                    {vendor.website ? (
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-300 hover:text-indigo-200"
                      >
                        {vendor.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </Section>

          <Section title="Address">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow label="Street" value={vendor.address} />
                <DetailRow label="City" value={vendor.city} />
                <DetailRow label="State" value={vendor.state} />
                <DetailRow label="Postal code" value={vendor.postal_code} />
                <DetailRow label="Country" value={vendor.country} />
              </dl>
            </div>
          </Section>

          <Section title="Operations Summary">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <MiniStat label="Contracts" value={operations?.total_contracts ?? '—'} hint={`${operations?.active_contracts ?? 0} active`} />
              <MiniStat label="Purchase Orders" value={operations?.total_orders ?? '—'} hint={`${operations?.active_orders ?? 0} in progress`} />
              <MiniStat
                label="Delivered"
                value={operations?.delivered_orders ?? '—'}
                valueClass="text-emerald-400"
                hint={
                  <span className={cn((operations?.delayed_orders ?? 0) > 0 ? 'text-red-400' : 'text-slate-500')}>
                    {operations?.delayed_orders ?? 0} delayed
                  </span>
                }
              />
              <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 sm:col-span-3">
                <p className="text-xs font-medium text-slate-500">Total order value</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-indigo-300">
                  {operations ? formatCurrency(operations.total_order_value) : '—'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/contracts?vendor_id=${vendor.id}`} className={softLinkClass}>
                <FileText className="h-3.5 w-3.5" />
                View contracts
              </Link>
              <Link to={`/purchase-orders?vendor_id=${vendor.id}`} className={softLinkClass}>
                <Package className="h-3.5 w-3.5" />
                View purchase orders
              </Link>
            </div>
          </Section>

          <Section title="Quality Summary">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <MiniStat label="Evaluations" value={quality?.total_evaluations ?? '—'} />
              <MiniStat
                label="Average Quality Score"
                value={quality?.average_quality_score !== null && quality?.average_quality_score !== undefined ? quality.average_quality_score : '—'}
                valueClass="text-indigo-300"
              />
              <MiniStat label="Defects" value={quality?.total_defects ?? '—'} valueClass="text-amber-300" />
              <MiniStat label="Excellent" value={quality?.excellent_evaluations ?? '—'} valueClass="text-emerald-400" />
              <MiniStat label="Good" value={quality?.good_evaluations ?? '—'} valueClass="text-green-400" />
              <MiniStat
                label="Poor + Critical"
                value={(quality?.poor_evaluations ?? 0) + (quality?.critical_evaluations ?? 0)}
                valueClass="text-red-400"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/quality-evaluations?vendor_id=${vendor.id}`} className={softLinkClass}>
                <Star className="h-3.5 w-3.5" />
                View quality evaluations
              </Link>
            </div>
          </Section>

          <Section title="Incident Summary">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <MiniStat label="Total Incidents" value={incidents?.total_incidents ?? '—'} />
              <MiniStat
                label="Open"
                value={incidents?.open_incidents ?? '—'}
                valueClass="text-blue-400"
                hint={`${incidents?.in_progress_incidents ?? 0} in progress`}
              />
              <MiniStat
                label="Critical"
                value={incidents?.critical_incidents ?? '—'}
                valueClass={(incidents?.critical_incidents ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}
                hint={`${incidents?.high_incidents ?? 0} high`}
              />
              <MiniStat label="Resolved" value={incidents?.resolved_incidents ?? '—'} valueClass="text-green-400" />
              <MiniStat label="Closed" value={incidents?.closed_incidents ?? '—'} valueClass="text-slate-300" />
              <MiniStat
                label="Avg Impact"
                value={incidents?.average_impact_score !== null && incidents?.average_impact_score !== undefined ? incidents.average_impact_score : '—'}
                valueClass="text-amber-300"
                hint="/ 10 scale"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/incidents?vendor_id=${vendor.id}`} className={softLinkClass}>
                <AlertTriangle className="h-3.5 w-3.5" />
                View incidents
              </Link>
            </div>
          </Section>

          <Section title="Performance Score">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Overall Score</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-100">
                  {performance?.overall_score !== null && performance?.overall_score !== undefined
                    ? performance.overall_score
                    : '—'}
                </p>
              </div>
              <div className="space-y-1.5 text-right">
                {performance && (
                  <PerformanceClassificationBadge classification={performance.classification} />
                )}
                {performance?.limited_data && (
                  <p className="text-xs font-medium text-amber-300">Limited data</p>
                )}
              </div>
            </div>
            {performance && (
              <>
                <p className="mt-2 text-xs text-slate-500">
                  Data confidence {performance.data_confidence}% · components available:{' '}
                  {performance.available_components.length > 0
                    ? performance.available_components.join(', ')
                    : 'none'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
                  <MiniStat
                    label="Delivery"
                    value={performance.delivery.score !== null ? performance.delivery.score : '—'}
                    valueClass="text-slate-300"
                    hint={`${performance.delivery.completed_deliveries} complete`}
                  />
                  <MiniStat
                    label="Quality"
                    value={performance.quality.score !== null ? performance.quality.score : '—'}
                    valueClass="text-slate-300"
                    hint={`${performance.quality.total_evaluations} evaluations`}
                  />
                  <MiniStat
                    label="Incidents"
                    value={performance.incidents.score}
                    valueClass="text-slate-300"
                    hint={`${performance.incidents.total_incidents} incidents`}
                  />
                </div>
                {performance.strengths.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {performance.strengths.map((strength) => (
                      <li key={strength} className="flex items-start gap-2 text-sm text-emerald-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                )}
                {performance.weaknesses.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {performance.weaknesses.map((weakness) => (
                      <li key={weakness} className="flex items-start gap-2 text-sm text-red-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        {weakness}
                      </li>
                    ))}
                  </ul>
                )}
                {performance.attention_areas.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {performance.attention_areas.map((area) => (
                      <li key={area} className="flex items-start gap-2 text-sm text-amber-200">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {area}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="mt-4">
              <Link to="/vendor-performance" className={softLinkClass}>
                Compare vendor performance
              </Link>
            </div>
          </Section>

          <Section title="Predictive Risk">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Risk Score</p>
                <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-100">
                  {risk?.risk_score !== null && risk?.risk_score !== undefined
                    ? risk.risk_score
                    : '—'}
                </p>
                <div className="mt-3">
                  <RiskScoreIndicator score={risk?.risk_score ?? null} />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                {risk && <RiskLevelBadge level={risk.risk_level ?? null} />}
                {risk && (
                  <p className={`text-xs font-medium ${RISK_TREND_STYLES[risk.risk_trend]}`}>
                    Trend: {RISK_TREND_LABELS[risk.risk_trend]}
                  </p>
                )}
              </div>
            </div>
            {risk && (
              <>
                <p className="mt-2 text-xs text-slate-500">
                  Confidence {RISK_CONFIDENCE_LABELS[risk.confidence]} · method:{' '}
                  {risk.prediction_method === 'RULE_BASED'
                    ? 'rule-based'
                    : risk.prediction_method === 'ML_BASED'
                      ? 'machine learning'
                      : 'hybrid'}
                  {risk.detail && ` · ${risk.detail}`}
                </p>
                {risk.risk_factors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Risk Factors
                    </p>
                    <ul className="mt-2 space-y-2">
                      {risk.risk_factors.map((factor) => (
                        <li key={factor.name} className="rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-red-200">{factor.name}</p>
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                              {factor.impact}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-red-300/80">{factor.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {risk.positive_factors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Positive Factors
                    </p>
                    <ul className="mt-2 space-y-2">
                      {risk.positive_factors.map((factor) => (
                        <li key={factor.name} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3">
                          <p className="text-sm font-medium text-emerald-200">{factor.name}</p>
                          <p className="mt-1 text-xs text-emerald-300/80">{factor.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {risk.positive_factors.length === 0 && risk.risk_factors.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">Insufficient data to derive factors.</p>
                )}
              </>
            )}
            <div className="mt-4">
              <Link to="/vendor-risk" className={softLinkClass}>
                Open Risk Center
              </Link>
            </div>
          </Section>

          <Section title="Trends & Analytics">
            {deliveryTrend === null && qualityTrend === null && incidentTrend === null ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading trends…</span>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Delivery Score</p>
                    <Link
                      to={`/analytics?vendor_id=${vendor.id}`}
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      View
                    </Link>
                  </div>
                  {!deliveryTrend?.has_sufficient_data ? (
                    <div className="flex h-32 items-center justify-center">
                      <EmptyChart />
                    </div>
                  ) : (
                    <TrendChart
                      data={deliveryTrend.items.map((item) => ({
                        period: item.period,
                        delivery_score: item.delivery_score,
                      }))}
                      series={[
                        {
                          key: 'delivery_score',
                          label: 'Delivery score',
                          color: TREND_COLORS.delivery,
                        },
                      ]}
                      yDomain={[0, 100]}
                      height={128}
                    />
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Quality Score</p>
                    <Link
                      to={`/analytics?vendor_id=${vendor.id}`}
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      View
                    </Link>
                  </div>
                  {!qualityTrend?.has_sufficient_data ? (
                    <div className="flex h-32 items-center justify-center">
                      <EmptyChart />
                    </div>
                  ) : (
                    <TrendChart
                      data={qualityTrend.items.map((item) => ({
                        period: item.period,
                        average_score: item.average_score,
                      }))}
                      series={[
                        {
                          key: 'average_score',
                          label: 'Quality score',
                          color: TREND_COLORS.quality,
                        },
                      ]}
                      yDomain={[0, 100]}
                      height={128}
                    />
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Incident Score</p>
                    <Link
                      to={`/analytics?vendor_id=${vendor.id}`}
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      View
                    </Link>
                  </div>
                  {!incidentTrend?.has_sufficient_data ? (
                    <div className="flex h-32 items-center justify-center">
                      <EmptyChart />
                    </div>
                  ) : (
                    <TrendChart
                      data={incidentTrend.items.map((item) => ({
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
                      height={128}
                    />
                  )}
                </div>
              </div>
            )}
            <div className="mt-4">
              <Link to={`/analytics?vendor_id=${vendor.id}`} className={softLinkClass}>
                Open in Advanced Analytics
              </Link>
            </div>
          </Section>
        </div>

        <div className="space-y-8">
          <Section title="System Information">
            <dl>
              <DetailRow label="Created" value={new Date(vendor.created_at).toLocaleString()} />
              <DetailRow label="Last updated" value={new Date(vendor.updated_at).toLocaleString()} />
              <DetailRow label="Vendor ID" value={<span className="font-mono text-xs">{vendor.id}</span>} />
            </dl>
          </Section>

          {canChangeStatus && (
            <Section title="Quick Actions">
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={deactivating}
                  onClick={async () => {
                    if (vendor == null) return
                    setDeactivating(true)
                    try {
                      await applyStatus(vendor.status, false)
                    } finally {
                      setDeactivating(false)
                    }
                  }}
                >
                  {deactivating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Deactivate vendor
                </Button>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Modal
        open={statusModalOpen}
        title="Change Vendor Status"
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || newStatus === vendor.status}
              onClick={() => void applyStatus(newStatus)}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Status
            </Button>
          </>
        }
      >
        <label
          htmlFor="status-select"
          className="block text-sm font-medium text-slate-300"
        >
          Status
        </label>
        <select
          id="status-select"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as VendorStatus)}
          className={cn(
            'mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm',
            'text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none',
          )}
        >
          {VENDOR_STATUSES.map((value) => (
            <option key={value} value={value}>
              {VENDOR_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Modal>
    </AppLayout>
  )
}