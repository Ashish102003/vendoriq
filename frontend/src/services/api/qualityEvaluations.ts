import { apiRequest } from './client'
import type {
  PaginatedQualityEvaluations,
  QualityEvaluationDetail,
  QualityEvaluationPayload,
  QualityEvaluationQuery,
  QualityEvaluationStatistics,
  QualityEvaluationUpdatePayload,
  VendorQualitySummary,
} from '../../types'

function toQueryString(query: QualityEvaluationQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.vendor_id !== undefined) params.set('vendor_id', String(query.vendor_id))
  if (query.contract_id !== undefined) params.set('contract_id', String(query.contract_id))
  if (query.purchase_order_id !== undefined)
    params.set('purchase_order_id', String(query.purchase_order_id))
  if (query.quality_status) params.set('quality_status', query.quality_status)
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const qualityEvaluationsApi = {
  list: (query: QualityEvaluationQuery = {}) =>
    apiRequest<PaginatedQualityEvaluations>(
      `/api/v1/quality-evaluations${toQueryString(query)}`,
    ),
  get: (id: number) =>
    apiRequest<QualityEvaluationDetail>(`/api/v1/quality-evaluations/${id}`),
  create: (payload: QualityEvaluationPayload) =>
    apiRequest<QualityEvaluationDetail>('/api/v1/quality-evaluations', {
      method: 'POST',
      body: payload,
    }),
  update: (id: number, payload: QualityEvaluationUpdatePayload) =>
    apiRequest<QualityEvaluationDetail>(`/api/v1/quality-evaluations/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
  statistics: () =>
    apiRequest<QualityEvaluationStatistics>('/api/v1/quality-evaluations/statistics'),
}

export const vendorQualityApi = {
  getSummary: (vendorId: number) =>
    apiRequest<VendorQualitySummary>(`/api/v1/vendors/${vendorId}/quality-summary`),
}