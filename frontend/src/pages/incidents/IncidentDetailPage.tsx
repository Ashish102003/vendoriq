import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  Loader2,
  Package,
  Pencil,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/common/Modal'
import { ErrorState } from '../../components/common/ErrorState'
import { IncidentSeverityBadge } from '../../components/incidents/IncidentSeverityBadge'
import { IncidentStatusBadge } from '../../components/incidents/IncidentStatusBadge'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { incidentsApi } from '../../services/api'
import {
  canManageIncidents,
  INCIDENT_TYPE_LABELS,
  INCIDENT_STATUS_LABELS,
} from '../../utils/permissions'
import { ALLOWED_INCIDENT_STATUS_TRANSITIONS } from '../../utils/incidents'
import { formatDate } from '../../utils/format'
import { isOverdue } from '../../utils/incidents'
import type { IncidentDetail, IncidentStatus } from '../../types'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
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

export function IncidentDetailPage() {
  const { incidentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const canEdit = canManageIncidents(roleName)

  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<IncidentStatus>('IN_PROGRESS')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    incidentsApi
      .get(Number(incidentId))
      .then((data) => {
        if (active) {
          setIncident(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load incident')
          setIncident(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [incidentId, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  function openStatusModal() {
    if (incident == null) return
    setNewStatus(
      ALLOWED_INCIDENT_STATUS_TRANSITIONS[incident.status][0] ?? incident.status,
    )
    setResolutionNotes(incident.resolution_notes ?? '')
    setStatusModalOpen(true)
  }

  async function applyStatus(nextStatus: IncidentStatus) {
    if (incident == null) return
    setSaving(true)
    try {
      const updated = await incidentsApi.update(incident.id, {
        status: nextStatus,
        resolution_notes: resolutionNotes.trim() || null,
      })
      setIncident(updated)
      setStatusModalOpen(false)
      showToast(
        `Incident marked as ${INCIDENT_STATUS_LABELS[nextStatus].toLowerCase()}`,
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
      <AppLayout title="Incidents">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading incident…</span>
        </div>
      </AppLayout>
    )
  }

  if (error || incident == null) {
    return (
      <AppLayout title="Incidents">
        <ErrorState
          message={error ?? 'Incident not found'}
          onRetry={handleRetry}
        />
      </AppLayout>
    )
  }

  const isOverdueIncident = isOverdue(incident.status, incident.due_date)

  return (
    <AppLayout title="Incidents">
      <Link
        to="/incidents"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to incidents
      </Link>

      <PageHeader
        title={`Incident ${incident.incident_number}`}
        subtitle={`${incident.title}`}
        actions={
          canEdit && incident.status !== 'CLOSED' ? (
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={openStatusModal}>
                Update Status
              </Button>
              <Button onClick={() => navigate(`/incidents/${incident.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit Incident
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <IncidentStatusBadge status={incident.status} />
        <IncidentSeverityBadge severity={incident.severity} />
        {isOverdueIncident && (
          <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
            Overdue
          </span>
        )}
        <span className="text-sm text-slate-500">
          Reported {formatDate(incident.reported_date)} by{' '}
          {incident.reported_by_user.first_name} {incident.reported_by_user.last_name}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Description">
            <p className="text-sm leading-relaxed text-slate-400">
              {incident.description}
            </p>
          </Section>

          <Section title="Resolution">
            <p className="text-sm leading-relaxed text-slate-400">
              {incident.resolution_notes || 'No resolution notes recorded yet.'}
            </p>
            {incident.resolved_date && (
              <p className="mt-3 text-xs text-slate-500">
                Resolved on {formatDate(incident.resolved_date)}
              </p>
            )}
          </Section>

          <Section title="Vendor">
            <Link
              to={`/vendors/${incident.vendor.id}`}
              className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                  {incident.vendor.company_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {incident.vendor.vendor_code}
                </p>
              </div>
            </Link>
          </Section>

          {incident.contract && (
            <Section title="Contract">
              <Link
                to={`/contracts/${incident.contract.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                    {incident.contract.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {incident.contract.contract_number}
                  </p>
                </div>
              </Link>
            </Section>
          )}

          {incident.purchase_order && (
            <Section title="Purchase Order">
              <Link
                to={`/purchase-orders/${incident.purchase_order.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                  <Package className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                    {incident.purchase_order.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {incident.purchase_order.order_number}
                  </p>
                </div>
              </Link>
            </Section>
          )}
        </div>

        <div className="space-y-8">
          <Section title="Details">
            <dl>
              <DetailRow
                label="Type"
                value={INCIDENT_TYPE_LABELS[incident.incident_type]}
              />
              <DetailRow
                label="Severity"
                value={<IncidentSeverityBadge severity={incident.severity} />}
              />
              <DetailRow
                label="Impact score"
                value={
                  <span className="tabular-nums">{incident.impact_score} / 10</span>
                }
              />
              <DetailRow label="Reported date" value={formatDate(incident.reported_date)} />
              <DetailRow label="Due date" value={incident.due_date ? formatDate(incident.due_date) : null} />
            </dl>
          </Section>

          <Section title="Assignment">
            <dl>
              <DetailRow
                label="Assigned to"
                value={
                  incident.assigned_to_user ? (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-semibold text-indigo-300">
                        {incident.assigned_to_user.first_name.charAt(0)}
                        {incident.assigned_to_user.last_name.charAt(0)}
                      </span>
                      {incident.assigned_to_user.first_name}{' '}
                      {incident.assigned_to_user.last_name}
                    </span>
                  ) : (
                    <span className="text-slate-500">Unassigned</span>
                  )
                }
              />
              <DetailRow
                label="Reported by"
                value={
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/60 text-[10px] font-semibold text-slate-400">
                      {incident.reported_by_user.first_name.charAt(0)}
                      {incident.reported_by_user.last_name.charAt(0)}
                    </span>
                    {incident.reported_by_user.first_name}{' '}
                    {incident.reported_by_user.last_name}
                    <span className="text-xs text-slate-500">
                      {incident.reported_by_user.email}
                    </span>
                  </span>
                }
              />
            </dl>
          </Section>

          {isOverdueIncident && (
            <section className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-5">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
                <div>
                  <h3 className="text-sm font-semibold text-orange-300">
                    This incident is overdue
                  </h3>
                  <p className="mt-1 text-xs text-orange-300/80">
                    {incident.due_date
                      ? `Resolve before ${formatDate(incident.due_date)} to avoid further delay penalties.`
                      : 'Set a due date to track resolution deadlines.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          <Section title="System Information">
            <dl>
              <DetailRow label="Created" value={new Date(incident.created_at).toLocaleString()} />
              <DetailRow label="Last updated" value={new Date(incident.updated_at).toLocaleString()} />
              <DetailRow label="Incident ID" value={<span className="font-mono text-xs">{incident.id}</span>} />
            </dl>
          </Section>
        </div>
      </div>

      <Modal
        title={`Update Status — ${incident.incident_number}`}
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-slate-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            Move this incident from{' '}
            <span className="font-medium text-slate-100">
              {INCIDENT_STATUS_LABELS[incident.status]}
            </span>{' '}
            to a new status.
          </p>
          <label className="block text-sm font-medium text-slate-300">
            New status
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
              className="mt-1.5 block h-10 w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 text-sm text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              {ALLOWED_INCIDENT_STATUS_TRANSITIONS[incident.status].map((value) => (
                <option key={value} value={value}>
                  {INCIDENT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Resolution notes
            {newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? (
              <span className="font-normal text-red-400"> *</span>
            ) : null}
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Describe how the incident was addressed"
              className="mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setStatusModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => applyStatus(newStatus)}
              disabled={
                saving ||
                ((newStatus === 'RESOLVED' || newStatus === 'CLOSED') &&
                  resolutionNotes.trim().length === 0)
              }
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {INCIDENT_STATUS_LABELS[newStatus]} Incident
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}