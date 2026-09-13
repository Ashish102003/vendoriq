import { apiRequest } from './client'
import type {
  DeliveryRecordPayload,
  PaginatedPurchaseOrders,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  PurchaseOrderQuery,
  PurchaseOrderStatistics,
  PurchaseOrderStatusUpdatePayload,
  PurchaseOrderUpdatePayload,
  VendorOperationsSummary,
} from '../../types'

function toQueryString(query: PurchaseOrderQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.vendor_id !== undefined) params.set('vendor_id', String(query.vendor_id))
  if (query.contract_id !== undefined) params.set('contract_id', String(query.contract_id))
  if (query.status) params.set('status', query.status)
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const purchaseOrdersApi = {
  list: (query: PurchaseOrderQuery = {}) =>
    apiRequest<PaginatedPurchaseOrders>(`/api/v1/purchase-orders${toQueryString(query)}`),
  get: (id: number) =>
    apiRequest<PurchaseOrderDetail>(`/api/v1/purchase-orders/${id}`),
  create: (payload: PurchaseOrderPayload) =>
    apiRequest<PurchaseOrderDetail>('/api/v1/purchase-orders', {
      method: 'POST',
      body: payload,
    }),
  update: (id: number, payload: PurchaseOrderUpdatePayload) =>
    apiRequest<PurchaseOrderDetail>(`/api/v1/purchase-orders/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
  updateStatus: (id: number, payload: PurchaseOrderStatusUpdatePayload) =>
    apiRequest<PurchaseOrderDetail>(`/api/v1/purchase-orders/${id}/status`, {
      method: 'PATCH',
      body: payload,
    }),
  recordDelivery: (id: number, payload: DeliveryRecordPayload) =>
    apiRequest<PurchaseOrderDetail>(`/api/v1/purchase-orders/${id}/delivery`, {
      method: 'PATCH',
      body: payload,
    }),
  statistics: () =>
    apiRequest<PurchaseOrderStatistics>('/api/v1/purchase-orders/statistics'),
}

export const vendorOperationsApi = {
  getSummary: (vendorId: number) =>
    apiRequest<VendorOperationsSummary>(`/api/v1/vendors/${vendorId}/operations-summary`),
}