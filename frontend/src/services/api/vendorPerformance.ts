import { apiRequest } from './client'
import type {
  PaginatedVendorPerformance,
  VendorPerformanceDetail,
  VendorPerformanceQuery,
  VendorPerformanceStatistics,
} from '../../types'

function toQueryString(query: VendorPerformanceQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.classification) params.set('classification', query.classification)
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const vendorPerformanceApi = {
  list: (query: VendorPerformanceQuery = {}) =>
    apiRequest<PaginatedVendorPerformance>(
      `/api/v1/vendors/performance${toQueryString(query)}`,
    ),
  get: (vendorId: number) =>
    apiRequest<VendorPerformanceDetail>(`/api/v1/vendors/${vendorId}/performance`),
  statistics: () =>
    apiRequest<VendorPerformanceStatistics>('/api/v1/vendors/performance/statistics'),
}