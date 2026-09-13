import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import {
  card,
  formInput,
  formInputArea,
  formSectionHeading,
  formAlertError,
  formLabel,
} from '../../styles/classes'
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
} from '../../utils/permissions'
import {
  ALLOWED_INCIDENT_STATUS_TRANSITIONS,
} from '../../utils/incidents'
import { contractsApi, purchaseOrdersApi } from '../../services/api'
import type {
  ContractListItem,
  IncidentDetail,
  IncidentPayload,
  IncidentStatus,
  IncidentUpdatePayload,
  PurchaseOrderListItem,
  UserListItem,
  VendorListItem,
} from '../../types'

interface IncidentFormProps {
  initialValues?: IncidentDetail | null
  isEdit: boolean
  vendors: VendorListItem[]
  users: UserListItem[]
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (
    payload: IncidentPayload | IncidentUpdatePayload,
  ) => Promise<void>
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className={formLabel}
      >
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function IncidentForm({
  initialValues,
  isEdit,
  vendors,
  users,
  submitLabel,
  isSubmitting,
  onSubmit,
}: IncidentFormProps) {
  const [form, setForm] = useState({
    vendor_id: initialValues?.vendor_id ?? 0,
    contract_id: initialValues?.contract_id ?? 0,
    purchase_order_id: initialValues?.purchase_order_id ?? 0,
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    incident_type: (initialValues?.incident_type ?? 'DELIVERY') as IncidentPayload['incident_type'],
    severity: (initialValues?.severity ?? 'MEDIUM') as IncidentPayload['severity'],
    impact_score: initialValues?.impact_score ?? 5,
    reported_date: initialValues?.reported_date ?? '',
    due_date: initialValues?.due_date ?? '',
    assigned_to: initialValues?.assigned_to ?? 0,
    status: (initialValues?.status ?? 'OPEN') as IncidentStatus,
    resolution_notes: initialValues?.resolution_notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<ContractListItem[] | null>(null)
  const [pos, setPos] = useState<PurchaseOrderListItem[] | null>(null)

  useEffect(() => {
    if (!form.vendor_id) return
    let active = true
    contractsApi
      .list({ vendor_id: form.vendor_id, page_size: 100 })
      .then((data) => {
        if (active) setContracts(data.items)
      })
      .catch(() => {
        if (active) setContracts([])
      })
    purchaseOrdersApi
      .list({ vendor_id: form.vendor_id, page_size: 100 })
      .then((data) => {
        if (active) setPos(data.items)
      })
      .catch(() => {
        if (active) setPos([])
      })
    return () => {
      active = false
    }
  }, [form.vendor_id])

  const visiblePos = (pos ?? []).filter(
    (po) =>
      form.contract_id === 0 ||
      po.contract === null ||
      po.contract.id === form.contract_id,
  )

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleVendorChange(value: number) {
    setForm((prev) => ({
      ...prev,
      vendor_id: value,
      contract_id: 0,
      purchase_order_id: 0,
    }))
    setContracts(null)
    setPos(null)
  }

  const resolvingOrClosed =
    form.status === 'RESOLVED' || form.status === 'CLOSED'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.vendor_id) {
      setError('Please select a vendor.')
      return
    }
    if (form.title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }
    if (form.description.trim().length < 3) {
      setError('Description is required.')
      return
    }
    if (!form.reported_date) {
      setError('Reported date is required.')
      return
    }
    const impact = Number(form.impact_score)
    if (!Number.isInteger(impact) || impact < 1 || impact > 10) {
      setError('Impact score must be an integer between 1 and 10.')
      return
    }
    if (form.due_date && form.due_date < form.reported_date) {
      setError('Due date must not be before the reported date.')
      return
    }
    if (resolvingOrClosed && form.resolution_notes.trim().length === 0) {
      setError('Resolution notes are required when an incident is resolved or closed.')
      return
    }

    if (isEdit) {
      const payload: IncidentUpdatePayload = {
        contract_id: form.contract_id || null,
        purchase_order_id: form.purchase_order_id || null,
        title: form.title.trim(),
        description: form.description.trim(),
        incident_type: form.incident_type,
        severity: form.severity,
        impact_score: impact,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
        resolution_notes: form.resolution_notes.trim() || null,
      }
      if (form.status !== (initialValues?.status ?? 'OPEN')) {
        payload.status = form.status
      }
      await onSubmit(payload)
      return
    }

    const payload: IncidentPayload = {
      vendor_id: form.vendor_id,
      contract_id: form.contract_id || null,
      purchase_order_id: form.purchase_order_id || null,
      title: form.title.trim(),
      description: form.description.trim(),
      incident_type: form.incident_type,
      severity: form.severity,
      impact_score: impact,
      reported_date: form.reported_date,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    }
    await onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className={card}>
        <h3 className={formSectionHeading}>Incident Context</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Vendor" htmlFor="vendor_id" required>
            <select
              id="vendor_id"
              value={form.vendor_id}
              onChange={(e) => handleVendorChange(Number(e.target.value))}
              disabled={isEdit}
              className={formInput}
            >
              <option value={0}>Select a vendor…</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.company_name} ({vendor.vendor_code})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Contract (optional)"
            htmlFor="contract_id"
            hint="Link to a contract with this vendor."
          >
            <select
              id="contract_id"
              value={form.contract_id}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  contract_id: Number(e.target.value),
                  purchase_order_id: 0,
                }))
              }}
              className={formInput}
              disabled={form.vendor_id === 0 || contracts === null}
            >
              <option value={0}>
                {form.vendor_id && contracts === null
                  ? 'Loading contracts…'
                  : 'No contract (optional)'}
              </option>
              {(contracts ?? []).map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_number} — {contract.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Purchase order (optional)"
              htmlFor="purchase_order_id"
              hint="Purchase orders are filtered to the selected vendor and contract."
            >
              <select
                id="purchase_order_id"
                value={form.purchase_order_id}
                onChange={(e) => update('purchase_order_id', Number(e.target.value))}
                className={formInput}
                disabled={form.vendor_id === 0 || pos === null}
              >
                <option value={0}>
                  {form.vendor_id && pos === null
                    ? 'Loading purchase orders…'
                    : 'No purchase order (optional)'}
                </option>
                {visiblePos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.order_number} — {po.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Incident Details</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="title" required>
              <input
                id="title"
                type="text"
                maxLength={150}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Short summary of the incident"
                className={formInput}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="description" required>
              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What happened, when it happened, and the expected outcome"
                className={formInputArea}
              />
            </Field>
          </div>
          <Field label="Incident type" htmlFor="incident_type" required>
            <select
              id="incident_type"
              value={form.incident_type}
              onChange={(e) =>
                update('incident_type', e.target.value as typeof form.incident_type)
              }
              className={formInput}
            >
              {INCIDENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {INCIDENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity" htmlFor="severity" required>
            <select
              id="severity"
              value={form.severity}
              onChange={(e) => update('severity', e.target.value as typeof form.severity)}
              className={formInput}
            >
              {INCIDENT_SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {INCIDENT_SEVERITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Impact score"
            htmlFor="impact_score"
            required
            hint="How impactful is this incident? 1 (minimal) to 10 (major)."
          >
            <div className="relative">
              <input
                id="impact_score"
                type="number"
                min="1"
                max="10"
                step="1"
                value={form.impact_score}
                onChange={(e) => update('impact_score', Number(e.target.value))}
                className={cn(formInput, 'pr-14')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-slate-400">
                / 10
              </span>
            </div>
          </Field>
          <Field label="Reported date" htmlFor="reported_date" required>
            <input
              id="reported_date"
              type="date"
              value={form.reported_date}
              onChange={(e) => update('reported_date', e.target.value)}
              className={formInput}
            />
          </Field>
          <Field
            label="Due date (optional)"
            htmlFor="due_date"
            hint="Target date for resolving this incident."
          >
            <input
              id="due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => update('due_date', e.target.value)}
              className={formInput}
            />
          </Field>
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Assignment</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Assigned to" htmlFor="assigned_to">
            <select
              id="assigned_to"
              value={form.assigned_to}
              onChange={(e) => update('assigned_to', Number(e.target.value))}
              className={formInput}
            >
              <option value={0}>Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} · {user.role_name ?? user.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reported by" htmlFor="reported_by">
            <input
              id="reported_by"
              type="text"
              value={isEdit ? (initialValues?.reported_by_user
                ? `${initialValues.reported_by_user.first_name} ${initialValues.reported_by_user.last_name}`
                : '') : 'Your account (set automatically)'}
              disabled
              readOnly
              className={formInput}
            />
          </Field>
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Incident Status</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label="Status"
            htmlFor="status"
            hint={
              isEdit
                ? 'Resolved and closed incidents require resolution notes.'
                : 'New incidents are always created as Open.'
            }
          >
            {isEdit ? (
              <select
                id="status"
                value={form.status}
                onChange={(e) => update('status', e.target.value as IncidentStatus)}
                className={formInput}
              >
                {INCIDENT_STATUSES.filter((value) =>
                  ALLOWED_INCIDENT_STATUS_TRANSITIONS[
                    initialValues?.status ?? 'OPEN'
                  ].includes(value),
                ).map((value) => (
                  <option key={value} value={value}>
                    {INCIDENT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="status"
                type="text"
                value="Open"
                disabled
                readOnly
                className={formInput}
              />
            )}
          </Field>
          {isEdit && initialValues?.resolved_date ? (
            <Field label="Resolved date" htmlFor="resolved_date">
              <input
                id="resolved_date"
                type="text"
                value={initialValues.resolved_date}
                disabled
                readOnly
                className={formInput}
              />
            </Field>
          ) : null}
          <div className="sm:col-span-2">
            <Field
              label="Resolution notes"
              htmlFor="resolution_notes"
              hint={
                resolvingOrClosed
                  ? 'Required to resolve or close this incident.'
                  : 'Optional notes describing the resolution.'
              }
            >
              <textarea
                id="resolution_notes"
                rows={3}
                value={form.resolution_notes}
                onChange={(e) => update('resolution_notes', e.target.value)}
                placeholder="Describe how the incident was addressed"
                className={formInputArea}
              />
            </Field>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className={formAlertError}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}