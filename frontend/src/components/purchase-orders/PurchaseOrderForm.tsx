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
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
  canManagePurchaseOrderStatus,
} from '../../utils/permissions'
import { contractsApi } from '../../services/api'
import type {
  ContractListItem,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  PurchaseOrderStatus,
  VendorListItem,
} from '../../types'

interface PurchaseOrderFormProps {
  initialValues?: PurchaseOrderDetail | null
  vendors: VendorListItem[]
  roleName: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (payload: PurchaseOrderPayload) => Promise<void>
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
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
    </div>
  )
}

export function PurchaseOrderForm({
  initialValues,
  vendors,
  roleName,
  submitLabel,
  isSubmitting,
  onSubmit,
}: PurchaseOrderFormProps) {
  const canEditStatus = canManagePurchaseOrderStatus(roleName)

  const [form, setForm] = useState({
    vendor_id: initialValues?.vendor_id ?? 0,
    contract_id: (initialValues?.contract_id ?? 0) as number,
    order_number: initialValues?.order_number ?? '',
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    order_value: initialValues?.order_value ?? '',
    order_date: initialValues?.order_date ?? '',
    expected_delivery_date: initialValues?.expected_delivery_date ?? '',
    status: (initialValues?.status ?? 'DRAFT') as PurchaseOrderStatus,
  })
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [contracts, setContracts] = useState<ContractListItem[] | null>(null)

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
    return () => {
      active = false
    }
  }, [form.vendor_id])

  function update<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleVendorChange(value: number) {
    setForm((prev) => ({
      ...prev,
      vendor_id: value,
      contract_id: 0,
    }))
    setContracts(null)
  }

  function handleDateChange(field: 'order_date' | 'expected_delivery_date', value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (next.order_date && next.expected_delivery_date && next.expected_delivery_date < next.order_date) {
        setDateError('Expected delivery date must be on or after the order date.')
      } else {
        setDateError(null)
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.vendor_id) {
      setError('Please select a vendor.')
      return
    }
    if (!form.order_number.trim()) {
      setError('Order number is required.')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    const value = Number(form.order_value)
    if (form.order_value === '' || Number.isNaN(value) || value < 0) {
      setError('Order value must be a non-negative number.')
      return
    }
    if (!form.order_date || !form.expected_delivery_date) {
      setError('Order date and expected delivery date are required.')
      return
    }
    if (dateError) return

    const payload: PurchaseOrderPayload = {
      vendor_id: form.vendor_id,
      contract_id: form.contract_id || null,
      order_number: form.order_number.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      order_value: value,
      order_date: form.order_date,
      expected_delivery_date: form.expected_delivery_date,
    }
    if (canEditStatus) payload.status = form.status

    await onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className={card}>
        <h3 className={formSectionHeading}>Order Information</h3>
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
          <Field label="Contract (optional)" htmlFor="contract_id">
            <select
              id="contract_id"
              value={form.contract_id}
              onChange={(e) => update('contract_id', Number(e.target.value))}
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
          <Field label="Order number" htmlFor="order_number" required>
            <input
              id="order_number"
              value={form.order_number}
              onChange={(e) => update('order_number', e.target.value.toUpperCase())}
              placeholder="PO-2026-001"
              className={formInput}
            />
          </Field>
          <Field label="Order value (INR)" htmlFor="order_value" required>
            <input
              id="order_value"
              type="number"
              min="0"
              step="0.01"
              value={form.order_value}
              onChange={(e) => update('order_value', e.target.value)}
              placeholder="25000.00"
              className={formInput}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="title" required>
              <input
                id="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Server hardware procurement"
                className={formInput}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Scope and purpose of the purchase order"
                className={formInputArea}
              />
            </Field>
          </div>
          {canEditStatus && (
            <Field label="Status" htmlFor="status">
              <select
                id="status"
                value={form.status}
                onChange={(e) => update('status', e.target.value as PurchaseOrderStatus)}
                className={formInput}
              >
                {PURCHASE_ORDER_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {PURCHASE_ORDER_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Order Timeline</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Order date" htmlFor="order_date" required>
            <input
              id="order_date"
              type="date"
              value={form.order_date}
              onChange={(e) => handleDateChange('order_date', e.target.value)}
              className={cn(formInput, dateError && 'border-red-500/50')}
            />
          </Field>
          <Field label="Expected delivery date" htmlFor="expected_delivery_date" required>
            <input
              id="expected_delivery_date"
              type="date"
              value={form.expected_delivery_date}
              onChange={(e) => handleDateChange('expected_delivery_date', e.target.value)}
              className={cn(formInput, dateError && 'border-red-500/50')}
            />
          </Field>
        </div>
        {dateError && (
          <p className="mt-3 text-xs text-red-400">{dateError}</p>
        )}
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