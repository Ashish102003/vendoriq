import { apiRequest } from './client'
import type {
  PaginatedVendors,
  VendorDetail,
  VendorPayload,
  VendorQuery,
  VendorStatistics,
  VendorStatusUpdatePayload,
  VendorUpdatePayload,
} from '../../types'

function toQueryString(query: VendorQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.category_id !== undefined)
    params.set('category_id', String(query.category_id))
  if (query.status) params.set('status', query.status)
  if (query.is_active !== undefined)
    params.set('is_active', String(query.is_active))
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const vendorsApi = {
  list: (query: VendorQuery = {}) =>
    apiRequest<PaginatedVendors>(`/api/v1/vendors${toQueryString(query)}`),
  get: (id: number) => apiRequest<VendorDetail>(`/api/v1/vendors/${id}`),
  create: (payload: VendorPayload) =>
    apiRequest<VendorDetail>('/api/v1/vendors', { method: 'POST', body: payload }),
  update: (id: number, payload: VendorUpdatePayload) =>
    apiRequest<VendorDetail>(`/api/v1/vendors/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
  updateStatus: (id: number, payload: VendorStatusUpdatePayload) =>
    apiRequest<VendorDetail>(`/api/v1/vendors/${id}/status`, {
      method: 'PATCH',
      body: payload,
    }),
  statistics: () =>
    apiRequest<VendorStatistics>('/api/v1/vendors/statistics'),
}