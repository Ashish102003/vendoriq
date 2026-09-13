import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import {
  formInput,
  formSection,
  formSectionHeading,
  formDivider,
  formAlertError,
  formLabel,
} from '../../styles/classes'
import { VENDOR_STATUSES, canManageVendorStatus, VENDOR_STATUS_LABELS } from '../../utils/permissions'
import type {
  VendorDetail,
  VendorPayload,
  VendorStatus,
  VendorCategoryWithCount,
} from '../../types'

interface VendorFormProps {
  initialValues?: VendorDetail | null
  categories: VendorCategoryWithCount[]
  roleName: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (payload: VendorPayload) => Promise<void>
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

export function VendorForm({
  initialValues,
  categories,
  roleName,
  submitLabel,
  isSubmitting,
  onSubmit,
}: VendorFormProps) {
  const isEdit = initialValues != null
  const canEditStatus = isEdit && canManageVendorStatus(roleName)

  const [form, setForm] = useState({
    vendor_code: initialValues?.vendor_code ?? '',
    company_name: initialValues?.company_name ?? '',
    contact_person: initialValues?.contact_person ?? '',
    email: initialValues?.email ?? '',
    phone: initialValues?.phone ?? '',
    website: initialValues?.website ?? '',
    address: initialValues?.address ?? '',
    city: initialValues?.city ?? '',
    state: initialValues?.state ?? '',
    country: initialValues?.country ?? '',
    postal_code: initialValues?.postal_code ?? '',
    category_id: initialValues?.category.id ?? 0,
    vendor_since: initialValues?.vendor_since ?? '',
    status: (initialValues?.status ?? 'PENDING') as VendorStatus,
  })
  const [error, setError] = useState<string | null>(null)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  function update<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleWebsiteChange(value: string) {
    setForm((prev) => ({ ...prev, website: value }))
    const trimmed = value.trim()
    if (trimmed && !/^https?:\/\//.test(trimmed)) {
      setWebsiteError('Website must start with http:// or https://')
    } else {
      setWebsiteError(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.vendor_code.trim() || !form.company_name.trim()) {
      setError('Vendor code and company name are required.')
      return
    }
    if (!form.category_id) {
      setError('Please select a vendor category.')
      return
    }
    if (websiteError) return

    const payload: VendorPayload = {
      vendor_code: form.vendor_code.trim(),
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim() || null,
      postal_code: form.postal_code.trim() || null,
      category_id: form.category_id,
      vendor_since: form.vendor_since || null,
    }
    if (canEditStatus) payload.status = form.status

    await onSubmit(payload)
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className={formSection}>
        <div className="sm:col-span-2">
          <h3 className={formSectionHeading}>Company</h3>
        </div>
        <Field label="Company name" htmlFor="company_name" required>
          <input
            id="company_name"
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            placeholder="Acme Technologies"
            className={formInput}
          />
        </Field>
        <Field label="Website" htmlFor="website">
          <input
            id="website"
            type="text"
            value={form.website}
            onChange={(e) => handleWebsiteChange(e.target.value)}
            placeholder="https://acme.example.com"
            className={cn(formInput, websiteError && 'border-red-500/50')}
          />
          {websiteError && (
            <p className="mt-1 text-xs text-red-400">{websiteError}</p>
          )}
        </Field>
        <Field label="Vendor code" htmlFor="vendor_code" required>
          <input
            id="vendor_code"
            value={form.vendor_code}
            onChange={(e) => update('vendor_code', e.target.value.toUpperCase())}
            placeholder="VEN-0001"
            className={formInput}
            disabled={isEdit}
          />
        </Field>
        <Field label="Category" htmlFor="category_id" required>
          <select
            id="category_id"
            value={form.category_id}
            onChange={(e) => update('category_id', Number(e.target.value))}
            className={formInput}
          >
            <option value={0}>Select a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vendor since" htmlFor="vendor_since">
          <input
            id="vendor_since"
            type="date"
            value={form.vendor_since}
            onChange={(e) => update('vendor_since', e.target.value)}
            className={formInput}
          />
        </Field>
        {canEditStatus && (
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              value={form.status}
              onChange={(e) => update('status', e.target.value as VendorStatus)}
              className={formInput}
            >
              {VENDOR_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {VENDOR_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className={formDivider}>
          <h3 className="text-sm font-semibold text-slate-100">Contact</h3>
        </div>
        <Field label="Contact person" htmlFor="contact_person">
          <input
            id="contact_person"
            value={form.contact_person}
            onChange={(e) => update('contact_person', e.target.value)}
            placeholder="Jane Cooper"
            className={formInput}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="contact@company.com"
            className={formInput}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+91 98765 43210"
            className={formInput}
          />
        </Field>

        <div className={formDivider}>
          <h3 className="text-sm font-semibold text-slate-100">Address</h3>
        </div>
        <div className="sm:col-span-2">
          <Field label="Street address" htmlFor="address">
            <input
              id="address"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="123 Business Park"
              className={formInput}
            />
          </Field>
        </div>
        <Field label="City" htmlFor="city">
          <input
            id="city"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Mumbai"
            className={formInput}
          />
        </Field>
        <Field label="State / Province" htmlFor="state">
          <input
            id="state"
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
            placeholder="Maharashtra"
            className={formInput}
          />
        </Field>
        <Field label="Country" htmlFor="country">
          <input
            id="country"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            placeholder="India"
            className={formInput}
          />
        </Field>
        <Field label="Postal code" htmlFor="postal_code">
          <input
            id="postal_code"
            value={form.postal_code}
            onChange={(e) => update('postal_code', e.target.value)}
            placeholder="400 001"
            className={formInput}
          />
        </Field>
      </div>

      {error && (
        <div
          role="alert"
          className={formAlertError}
        >
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