import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { VendorForm } from '../../components/vendors/VendorForm'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { vendorsApi, vendorCategoriesApi } from '../../services/api'
import { canCreateVendor } from '../../utils/permissions'
import type { VendorDetail, VendorPayload, VendorCategoryWithCount } from '../../types'

export function VendorFormPage() {
  const { vendorId } = useParams()
  const isEdit = vendorId != null
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const allowed = canCreateVendor(roleName)

  const [categories, setCategories] = useState<VendorCategoryWithCount[]>([])
  const [initialValues, setInitialValues] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let active = true
    vendorCategoriesApi
      .list()
      .then((categoriesData) => {
        if (!active) return
        setCategories(categoriesData)
        return isEdit ? vendorsApi.get(Number(vendorId)).catch(() => null) : Promise.resolve(null)
      })
      .then((vendor: VendorDetail | null | undefined) => {
        if (!active) return
        if (isEdit && vendor === null) {
          setError('Vendor not found')
        } else {
          setError(null)
          setInitialValues(vendor ?? null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load form')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [allowed, isEdit, vendorId])

  const handleSubmit = useCallback(
    async (payload: VendorPayload) => {
      setSubmitting(true)
      const errorDefault = isEdit
        ? 'Failed to update vendor'
        : 'Failed to create vendor'
      try {
        const vendor = isEdit
          ? await vendorsApi.update(Number(vendorId), payload)
          : await vendorsApi.create(payload)
        showToast(
          isEdit
            ? 'Vendor updated successfully'
            : 'Vendor created successfully',
          'success',
        )
        navigate(`/vendors/${vendor.id}`)
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : errorDefault
        showToast(message, 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [isEdit, vendorId, navigate, showToast],
  )

  if (!allowed) {
    return (
      <AppLayout title="Vendors">
        <PageHeader title={isEdit ? 'Edit Vendor' : 'Add Vendor'} />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Access restricted</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your role does not allow creating or editing vendors.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Vendors">
      <PageHeader
        title={isEdit ? 'Edit Vendor' : 'Add Vendor'}
        subtitle={
          isEdit
            ? 'Update the vendor details below.'
            : 'Record a new vendor. New vendors start with a Pending status.'
        }
      />
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => navigate('/vendors')}
        />
      ) : loading ? (
        <div className="iq-card flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        categories.length > 0 && (
          <VendorForm
            key={initialValues?.id ?? 'new'}
            initialValues={initialValues}
            categories={categories}
            roleName={roleName}
            submitLabel={isEdit ? 'Save Changes' : 'Create Vendor'}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        )
      )}
      {!error && !loading && categories.length === 0 && (
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">No categories yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a vendor category first so you can assign it to vendors.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => navigate('/vendor-categories')}
            >
              Manage Categories
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}