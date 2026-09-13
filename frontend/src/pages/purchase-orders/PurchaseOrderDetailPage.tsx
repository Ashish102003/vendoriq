import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarRange,
  FileText,
  IndianRupee,
  Loader2,
  Package,
  PackageCheck,
  Pencil,
  Truck,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/common/Modal'
import { ErrorState } from '../../components/common/ErrorState'
import { DeliveryStatusBadge } from '../../components/purchase-orders/DeliveryStatusBadge'
import { PurchaseOrderStatusBadge } from '../../components/purchase-orders/PurchaseOrderStatusBadge'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { purchaseOrdersApi } from '../../services/api'
import {
  canManagePurchaseOrderStatus,
  canManagePurchaseOrders,
  canRecordDelivery,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
} from '../../utils/permissions'
import { formatCurrency, formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { PurchaseOrderDetail, PurchaseOrderStatus } from '../../types'

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

function DeliveryResult({ po }: { po: PurchaseOrderDetail }) {
  if (po.delivery_status === 'PENDING') {
    return (
      <div className="flex items-start gap-2.5">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <dl>
          <DetailRow label="Delivery status" value={<DeliveryStatusBadge status={po.delivery_status} />} />
          <DetailRow label="Expected delivery" value={formatDate(po.expected_delivery_date)} />
          <DetailRow
            label="Actual delivery"
            value={po.actual_delivery_date != null ? formatDate(po.actual_delivery_date) : 'Not yet recorded'}
          />
        </dl>
      </div>
    )
  }

  const label =
    po.delivery_status === 'DELAYED' ? 'Delayed' : 'Delivered On Time'
  const delay = po.delay_days ?? 0
  return (
    <div className="flex items-start gap-2.5">
      <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <dl>
        <DetailRow label="Delivery status" value={<DeliveryStatusBadge status={po.delivery_status} />} />
        <DetailRow label="Expected delivery" value={formatDate(po.expected_delivery_date)} />
        <DetailRow label="Actual delivery" value={formatDate(po.actual_delivery_date)} />
        <DetailRow
          label="Result"
          value={
            <span
              className={cn(
                'text-sm font-medium',
                po.delivery_status === 'DELAYED' ? 'text-red-400' : 'text-emerald-400',
              )}
            >
              {label}
              {po.delivery_status === 'DELAYED' && ` · Delay: ${delay} Day${delay === 1 ? '' : 's'}`}
            </span>
          }
        />
      </dl>
    </div>
  )
}

export function PurchaseOrderDetailPage() {
  const { purchaseOrderId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const canEdit = canManagePurchaseOrders(roleName)
  const canChangeStatus = canManagePurchaseOrderStatus(roleName)
  const canDeliver = canRecordDelivery(roleName)

  const [po, setPo] = useState<PurchaseOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<PurchaseOrderStatus>('ISSUED')
  const [actualDate, setActualDate] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState<PurchaseOrderStatus | ''>('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    purchaseOrdersApi
      .get(Number(purchaseOrderId))
      .then((data) => {
        if (active) {
          setPo(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load purchase order')
          setPo(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [purchaseOrderId, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  async function applyStatus(nextStatus: PurchaseOrderStatus) {
    if (po == null) return
    setSaving(true)
    try {
      const updated = await purchaseOrdersApi.updateStatus(po.id, {
        status: nextStatus,
      })
      setPo(updated)
      setStatusModalOpen(false)
      showToast('Purchase order status updated', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update status',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  async function applyDelivery() {
    if (po == null) return
    if (!actualDate) {
      showToast('Please select the actual delivery date.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: {
        actual_delivery_date: string
        status?: PurchaseOrderStatus
      } = { actual_delivery_date: actualDate }
      if (deliveryStatus !== '') payload.status = deliveryStatus
      const updated = await purchaseOrdersApi.recordDelivery(po.id, payload)
      setPo(updated)
      setDeliveryModalOpen(false)
      setActualDate('')
      setDeliveryStatus('')
      showToast('Delivery recorded', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to record delivery',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Purchase Orders">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading purchase order…</span>
        </div>
      </AppLayout>
    )
  }

  if (error || po == null) {
    return (
      <AppLayout title="Purchase Orders">
        <ErrorState
          message={error ?? 'Purchase order not found'}
          onRetry={handleRetry}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Purchase Orders">
      <Link
        to="/purchase-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to purchase orders
      </Link>

      <PageHeader
        title={po.title}
        subtitle={po.order_number}
        actions={
          <>
            {canChangeStatus && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNewStatus(po.status)
                  setStatusModalOpen(true)
                }}
              >
                Change Status
              </Button>
            )}
            {canDeliver && (
              <Button
                variant="secondary"
                onClick={() => {
                  setActualDate(po.actual_delivery_date ?? '')
                  setDeliveryStatus('')
                  setDeliveryModalOpen(true)
                }}
              >
                <Truck className="h-4 w-4" />
                Record Delivery
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit Purchase Order
              </Button>
            )}
          </>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <PurchaseOrderStatusBadge status={po.status} />
        <DeliveryStatusBadge status={po.delivery_status} />
        <span className="text-sm text-slate-500">
          Ordered {formatDate(po.order_date)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Order Overview">
            <dl>
              <p className="text-sm leading-relaxed text-slate-400">
                Purchase order <span className="font-mono">{po.order_number}</span>{' '}
                placed with{' '}
                <span className="font-medium text-slate-100">{po.vendor.company_name}</span>,
                valued at{' '}
                <span className="font-medium text-slate-100">
                  {formatCurrency(po.order_value)}
                </span>.
              </p>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Order number" value={po.order_number} />
                <DetailRow label="Status" value={PURCHASE_ORDER_STATUS_LABELS[po.status]} />
                <DetailRow label="Order value" value={formatCurrency(po.order_value)} />
                <DetailRow label="Order date" value={formatDate(po.order_date)} />
                <DetailRow label="Expected delivery" value={formatDate(po.expected_delivery_date)} />
                <DetailRow label="Actual delivery" value={formatDate(po.actual_delivery_date)} />
              </div>
            </dl>
          </Section>

          <Section title="Delivery">
            <DeliveryResult po={po} />
          </Section>

          <Section title="Description">
            <p className="text-sm leading-relaxed text-slate-400">
              {po.description || 'No description provided for this purchase order.'}
            </p>
          </Section>

          <Section title="Vendor">
            <Link
              to={`/vendors/${po.vendor.id}`}
              className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                  {po.vendor.company_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {po.vendor.vendor_code}
                </p>
              </div>
            </Link>
          </Section>

          {po.contract && (
            <Section title="Contract">
              <Link
                to={`/contracts/${po.contract.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                    {po.contract.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {po.contract.contract_number}
                  </p>
                </div>
              </Link>
            </Section>
          )}
        </div>

        <div className="space-y-8">
          <Section title="System Information">
            <dl>
              <DetailRow label="Created" value={new Date(po.created_at).toLocaleString()} />
              <DetailRow label="Last updated" value={new Date(po.updated_at).toLocaleString()} />
              <DetailRow label="Order ID" value={<span className="font-mono text-xs">{po.id}</span>} />
            </dl>
          </Section>

          <Section title="Order Timeline">
            <div className="flex items-start gap-2.5">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow label="Order date" value={formatDate(po.order_date)} />
                <DetailRow label="Expected delivery" value={formatDate(po.expected_delivery_date)} />
                <DetailRow label="Actual delivery" value={formatDate(po.actual_delivery_date)} />
              </dl>
            </div>
          </Section>

          <Section title="Order Value">
            <div className="flex items-start gap-2.5">
              <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow label="Order value" value={formatCurrency(po.order_value)} />
              </dl>
            </div>
          </Section>

          {canDeliver && (
            <Section title="Quick Actions">
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setActualDate(po.actual_delivery_date ?? '')
                    setDeliveryStatus('')
                    setDeliveryModalOpen(true)
                  }}
                >
                  <CalendarRange className="h-4 w-4" />
                  Record Delivery
                </Button>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Modal
        open={statusModalOpen}
        title="Change Purchase Order Status"
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || newStatus === po.status}
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
          onChange={(e) => setNewStatus(e.target.value as PurchaseOrderStatus)}
          className={cn(
            'mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm',
            'text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none',
          )}
        >
          {PURCHASE_ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PURCHASE_ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Modal>

      <Modal
        open={deliveryModalOpen}
        title="Record Delivery"
        onClose={() => setDeliveryModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeliveryModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void applyDelivery()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Delivery
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="delivery-date"
              className="block text-sm font-medium text-slate-300"
            >
              Actual delivery date
            </label>
            <input
              id="delivery-date"
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className={cn(
                'mt-1.5 block h-10 w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 text-sm',
                'text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none',
              )}
            />
          </div>
          <div>
            <label
              htmlFor="delivery-status"
              className="block text-sm font-medium text-slate-300"
            >
              Order status{' '}
              <span className="text-xs font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id="delivery-status"
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value as PurchaseOrderStatus | '')}
              className={cn(
                'mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm',
                'text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none',
              )}
            >
              <option value="">Leave unchanged</option>
              {PURCHASE_ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PURCHASE_ORDER_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          {po.actual_delivery_date != null && (
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A delivery was previously recorded on{' '}
              {formatDate(po.actual_delivery_date)}. Saving will overwrite it.
            </p>
          )}
        </div>
      </Modal>
    </AppLayout>
  )
}