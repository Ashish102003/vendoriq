import { apiRequest } from './client'
import type {
  ContractDetail,
  ContractPayload,
  ContractQuery,
  ContractStatistics,
  ContractStatusUpdatePayload,
  ContractUpdatePayload,
  PaginatedContracts,
} from '../../types'

function toQueryString(query: ContractQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.vendor_id !== undefined) params.set('vendor_id', String(query.vendor_id))
  if (query.status) params.set('status', query.status)
  if (query.is_active !== undefined) params.set('is_active', String(query.is_active))
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const contractsApi = {
  list: (query: ContractQuery = {}) =>
    apiRequest<PaginatedContracts>(`/api/v1/contracts${toQueryString(query)}`),
  get: (id: number) => apiRequest<ContractDetail>(`/api/v1/contracts/${id}`),
  create: (payload: ContractPayload) =>
    apiRequest<ContractDetail>('/api/v1/contracts', { method: 'POST', body: payload }),
  update: (id: number, payload: ContractUpdatePayload) =>
    apiRequest<ContractDetail>(`/api/v1/contracts/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
  updateStatus: (id: number, payload: ContractStatusUpdatePayload) =>
    apiRequest<ContractDetail>(`/api/v1/contracts/${id}/status`, {
      method: 'PATCH',
      body: payload,
    }),
statistics: () =>
      apiRequest<ContractStatistics>('/api/v1/contracts/statistics'),
}