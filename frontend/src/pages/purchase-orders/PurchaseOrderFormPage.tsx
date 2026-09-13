import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { PurchaseOrderForm } from '../../components/purchase-orders/PurchaseOrderForm'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { purchaseOrdersApi, vendorsApi } from '../../services/api'
import { canManagePurchaseOrders } from '../../utils/permissions'
import type { PurchaseOrderDetail, PurchaseOrderPayload, VendorListItem } from '../../types'

export function PurchaseOrderFormPage() {
  const { purchaseOrderId } = useParams()
  const isEdit = purchaseOrderId != null
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const allowed = canManagePurchaseOrders(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [initialValues, setInitialValues] = useState<PurchaseOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let active = true
    vendorsApi
      .list({ page_size: 100 })
      .then((data) => {
        if (!active) return
        setVendors(data.items)
        return isEdit
          ? purchaseOrdersApi.get(Number(purchaseOrderId)).catch(() => null)
          : Promise.resolve(null)
      })
      .then((po: PurchaseOrderDetail | null | undefined) => {
        if (!active) return
        if (isEdit && po === null) {
          setError('Purchase order not found')
        } else {
          setError(null)
          setInitialValues(po ?? null)
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
  }, [allowed, isEdit, purchaseOrderId])

  const handleSubmit = useCallback(
    async (payload: PurchaseOrderPayload) => {
      setSubmitting(true)
      const errorDefault = isEdit
        ? 'Failed to update purchase order'
        : 'Failed to create purchase order'
      try {
        const po = isEdit
          ? await purchaseOrdersApi.update(Number(purchaseOrderId), payload)
          : await purchaseOrdersApi.create(payload)
        showToast(
          isEdit
            ? 'Purchase order updated successfully'
            : 'Purchase order created successfully',
          'success',
        )
        navigate(`/purchase-orders/${po.id}`)
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : errorDefault
        showToast(message, 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [isEdit, purchaseOrderId, navigate, showToast],
  )

  if (!allowed) {
    return (
      <AppLayout title="Purchase Orders">
        <PageHeader title={isEdit ? 'Edit Purchase Order' : 'Add Purchase Order'} />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Access restricted</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your role does not allow creating or editing purchase orders.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Purchase Orders">
      <PageHeader
        title={isEdit ? 'Edit Purchase Order' : 'Add Purchase Order'}
        subtitle={
          isEdit
            ? 'Update the purchase order details below.'
            : 'Create a new purchase order to track a vendor delivery commitment.'
        }
      />
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => navigate('/purchase-orders')}
        />
      ) : loading ? (
        <div className="iq-card flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        vendors.length > 0 && (
          <PurchaseOrderForm
            key={initialValues?.id ?? 'new'}
            initialValues={initialValues}
            vendors={vendors}
            roleName={roleName}
            submitLabel={isEdit ? 'Save Changes' : 'Create Purchase Order'}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        )
      )}
      {!error && !loading && vendors.length === 0 && (
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">No vendors are available</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a vendor before creating a purchase order.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate('/vendors/new')}>
              Add Vendor
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}