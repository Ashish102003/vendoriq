import { useState, type FormEvent } from 'react'
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
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  canManageContractStatus,
} from '../../utils/permissions'
import type {
  ContractDetail,
  ContractPayload,
  ContractStatus,
  VendorListItem,
} from '../../types'

interface ContractFormProps {
  initialValues?: ContractDetail | null
  vendors: VendorListItem[]
  roleName: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (payload: ContractPayload) => Promise<void>
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

export function ContractForm({
  initialValues,
  vendors,
  roleName,
  submitLabel,
  isSubmitting,
  onSubmit,
}: ContractFormProps) {
  const canEditStatus = canManageContractStatus(roleName)

  const [form, setForm] = useState({
    vendor_id: initialValues?.vendor.id ?? 0,
    contract_number: initialValues?.contract_number ?? '',
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    contract_value: initialValues?.contract_value ?? '',
    start_date: initialValues?.start_date ?? '',
    end_date: initialValues?.end_date ?? '',
    status: (initialValues?.status ?? 'DRAFT') as ContractStatus,
  })
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  function update<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleDateChange(field: 'start_date' | 'end_date', value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (next.start_date && next.end_date && next.end_date < next.start_date) {
        setDateError('End date must be on or after the start date.')
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
    if (!form.contract_number.trim()) {
      setError('Contract number is required.')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    const value = Number(form.contract_value)
    if (form.contract_value === '' || Number.isNaN(value) || value < 0) {
      setError('Contract value must be a non-negative number.')
      return
    }
    if (!form.start_date || !form.end_date) {
      setError('Start date and end date are required.')
      return
    }
    if (dateError) return

    const payload: ContractPayload = {
      vendor_id: form.vendor_id,
      contract_number: form.contract_number.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      contract_value: value,
      start_date: form.start_date,
      end_date: form.end_date,
    }
    if (canEditStatus) payload.status = form.status

    await onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className={card}>
        <h3 className={formSectionHeading}>Contract Information</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Vendor" htmlFor="vendor_id" required>
            <select
              id="vendor_id"
              value={form.vendor_id}
              onChange={(e) => update('vendor_id', Number(e.target.value))}
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
          <Field label="Contract number" htmlFor="contract_number" required>
            <input
              id="contract_number"
              value={form.contract_number}
              onChange={(e) => update('contract_number', e.target.value.toUpperCase())}
              placeholder="CNT-2026-001"
              className={formInput}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="title" required>
              <input
                id="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Infrastructure Support Agreement"
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
                placeholder="Scope and purpose of the contractual engagement"
                className={formInputArea}
              />
            </Field>
          </div>
          <Field label="Contract value (INR)" htmlFor="contract_value" required>
            <input
              id="contract_value"
              type="number"
              min="0"
              step="0.01"
              value={form.contract_value}
              onChange={(e) => update('contract_value', e.target.value)}
              placeholder="250000.00"
              className={formInput}
            />
          </Field>
          {canEditStatus && (
            <Field label="Status" htmlFor="status">
              <select
                id="status"
                value={form.status}
                onChange={(e) => update('status', e.target.value as ContractStatus)}
                className={formInput}
              >
                {CONTRACT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {CONTRACT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className={formSectionHeading}>Contract Period</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Start date" htmlFor="start_date" required>
            <input
              id="start_date"
              type="date"
              value={form.start_date}
              onChange={(e) => handleDateChange('start_date', e.target.value)}
              className={cn(formInput, dateError && 'border-red-500/50')}
            />
          </Field>
          <Field label="End date" htmlFor="end_date" required>
            <input
              id="end_date"
              type="date"
              value={form.end_date}
              onChange={(e) => handleDateChange('end_date', e.target.value)}
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