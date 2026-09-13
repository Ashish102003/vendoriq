import { apiRequest } from './client'
import type {
  IncidentDetail,
  IncidentPayload,
  IncidentQuery,
  IncidentStatistics,
  IncidentUpdatePayload,
  PaginatedIncidents,
  VendorIncidentSummary,
} from '../../types'

function toQueryString(query: IncidentQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.vendor_id !== undefined) params.set('vendor_id', String(query.vendor_id))
  if (query.contract_id !== undefined) params.set('contract_id', String(query.contract_id))
  if (query.purchase_order_id !== undefined)
    params.set('purchase_order_id', String(query.purchase_order_id))
  if (query.incident_type) params.set('incident_type', query.incident_type)
  if (query.severity) params.set('severity', query.severity)
  if (query.incident_status) params.set('incident_status', query.incident_status)
  if (query.date_from) params.set('date_from', query.date_from)
  if (query.date_to) params.set('date_to', query.date_to)
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const incidentsApi = {
  list: (query: IncidentQuery = {}) =>
    apiRequest<PaginatedIncidents>(`/api/v1/incidents${toQueryString(query)}`),
  get: (id: number) => apiRequest<IncidentDetail>(`/api/v1/incidents/${id}`),
  create: (payload: IncidentPayload) =>
    apiRequest<IncidentDetail>('/api/v1/incidents', {
      method: 'POST',
      body: payload,
    }),
  update: (id: number, payload: IncidentUpdatePayload) =>
    apiRequest<IncidentDetail>(`/api/v1/incidents/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
  statistics: () =>
    apiRequest<IncidentStatistics>('/api/v1/incidents/statistics'),
}

export const vendorIncidentsApi = {
  getSummary: (vendorId: number) =>
    apiRequest<VendorIncidentSummary>(`/api/v1/vendors/${vendorId}/incident-summary`),
}