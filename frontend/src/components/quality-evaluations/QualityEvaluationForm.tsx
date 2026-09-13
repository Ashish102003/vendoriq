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
  QUALITY_STATUSES,
  QUALITY_STATUS_LABELS,
} from '../../utils/permissions'
import { contractsApi, purchaseOrdersApi } from '../../services/api'
import { expectedQualityStatus } from '../../utils/quality'
import type {
  ContractListItem,
  PurchaseOrderListItem,
  QualityEvaluationDetail,
  QualityEvaluationPayload,
  QualityStatus,
  VendorListItem,
} from '../../types'

interface QualityEvaluationFormProps {
  initialValues?: QualityEvaluationDetail | null
  vendors: VendorListItem[]
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (payload: QualityEvaluationPayload) => Promise<void>
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

export function QualityEvaluationForm({
  initialValues,
  vendors,
  submitLabel,
  isSubmitting,
  onSubmit,
}: QualityEvaluationFormProps) {
  const [form, setForm] = useState({
    vendor_id: initialValues?.vendor_id ?? 0,
    contract_id: initialValues?.contract_id ?? 0,
    purchase_order_id: initialValues?.purchase_order_id ?? 0,
    evaluation_date: initialValues?.evaluation_date ?? '',
    quality_score: initialValues?.quality_score ?? 75,
    defect_count: initialValues?.defect_count ?? '0',
    total_items: initialValues?.total_items ?? '0',
    quality_status: (initialValues?.quality_status ?? 'GOOD') as QualityStatus,
    comments: initialValues?.comments ?? '',
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

  function update<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.vendor_id) {
      setError('Please select a vendor.')
      return
    }
    if (!form.evaluation_date) {
      setError('Evaluation date is required.')
      return
    }
    const score = Number(form.quality_score)
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setError('Quality score must be an integer between 0 and 100.')
      return
    }
    const defects = Number(form.defect_count)
    const items = Number(form.total_items)
    if (!Number.isInteger(defects) || defects < 0) {
      setError('Defect count must be a non-negative integer.')
      return
    }
    if (!Number.isInteger(items) || items < 0) {
      setError('Total items must be a non-negative integer.')
      return
    }
    if (items > 0 && defects > items) {
      setError('Defect count must not exceed total items.')
      return
    }
    if (form.quality_status !== expectedQualityStatus(score)) {
      setError(
        'The selected quality status does not match the quality score.',
      )
      return
    }

    const payload: QualityEvaluationPayload = {
      vendor_id: form.vendor_id,
      contract_id: form.contract_id || null,
      purchase_order_id: form.purchase_order_id || null,
      evaluation_date: form.evaluation_date,
      quality_score: score,
      defect_count: defects,
      total_items: items,
      quality_status: form.quality_status,
      comments: form.comments.trim() || null,
    }

    await onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className={card}>
        <h3 className={formSectionHeading}>Evaluation Context</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Vendor" htmlFor="vendor_id" required>
            <select
              id="vendor_id"
              value={form.vendor_id}
              onChange={(e) => handleVendorChange(Number(e.target.value))}
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
        <h3 className={formSectionHeading}>Quality Assessment</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Evaluation date" htmlFor="evaluation_date" required>
            <input
              id="evaluation_date"
              type="date"
              value={form.evaluation_date}
              onChange={(e) => update('evaluation_date', e.target.value)}
              className={formInput}
            />
          </Field>
          <Field
            label="Quality score"
            htmlFor="quality_score"
            required
            hint="0 to 100"
          >
            <div className="relative">
              <input
                id="quality_score"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.quality_score}
                onChange={(e) => update('quality_score', Number(e.target.value))}
                className={cn(formInput, 'pr-14')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-slate-400">
                / 100
              </span>
            </div>
          </Field>
          <Field
            label="Quality status"
            htmlFor="quality_status"
            required
            hint="Excellent 90–100 · Good 75–89 · Acceptable 60–74 · Poor 40–59 · Critical 0–39"
          >
            <select
              id="quality_status"
              value={form.quality_status}
              onChange={(e) => update('quality_status', e.target.value as QualityStatus)}
              className={formInput}
            >
              {QUALITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {QUALITY_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Defect count"
            htmlFor="defect_count"
            hint="Defects found in the inspected items."
          >
            <input
              id="defect_count"
              type="number"
              min="0"
              step="1"
              value={form.defect_count}
              onChange={(e) => update('defect_count', e.target.value)}
              className={formInput}
            />
          </Field>
          <Field
            label="Total items"
            htmlFor="total_items"
            hint="Total quantity inspected. Leave 0 for a general review."
          >
            <input
              id="total_items"
              type="number"
              min="0"
              step="1"
              value={form.total_items}
              onChange={(e) => update('total_items', e.target.value)}
              className={formInput}
            />
          </Field>
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Observations</h3>
        <div className="mt-5">
          <Field label="Comments" htmlFor="comments">
            <textarea
              id="comments"
              rows={4}
              value={form.comments}
              onChange={(e) => update('comments', e.target.value)}
              placeholder="Notes on the inspection, findings, and follow-up actions"
              className={formInputArea}
            />
          </Field>
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