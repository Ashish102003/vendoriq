import { apiRequest } from './client'
import type {
  ModelInfo,
  PaginatedVendorRiskList,
  PredictiveRisk,
  RiskStatistics,
  TrainingResult,
  VendorRiskQuery,
} from '../../types'

function toQueryString(query: VendorRiskQuery): string {
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size))
  if (query.search) params.set('search', query.search)
  if (query.category_id !== undefined) params.set('category_id', String(query.category_id))
  if (query.risk_level) params.set('risk_level', query.risk_level)
  if (query.sort_by) params.set('sort_by', query.sort_by)
  if (query.sort_order) params.set('sort_order', query.sort_order)
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const vendorRiskApi = {
  list: (query: VendorRiskQuery = {}) =>
    apiRequest<PaginatedVendorRiskList>(`/api/v1/vendor-risk${toQueryString(query)}`),
  statistics: () =>
    apiRequest<RiskStatistics>('/api/v1/vendor-risk/statistics'),
  modelInfo: () =>
    apiRequest<ModelInfo>('/api/v1/vendor-risk/model-info'),
  train: () =>
    apiRequest<TrainingResult>('/api/v1/vendor-risk/train', { method: 'POST' }),
  getVendorRisk: (vendorId: number) =>
    apiRequest<PredictiveRisk>(`/api/v1/vendors/${vendorId}/predictive-risk`),
}