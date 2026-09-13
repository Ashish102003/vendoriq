import { apiRequest } from './client'
import type {
  AnalyticsOverview,
  AnalyticsQuery,
  CategoryPerformance,
  DeliveryTrend,
  IncidentSeverityDistribution,
  IncidentTrend,
  PerformanceDistribution,
  PerformanceTrend,
  QualityTrend,
  VendorComparison,
  VendorRanking,
} from '../../types'

function toQueryString(query: AnalyticsQuery): string {
  const params = new URLSearchParams()
  if (query.start_date) params.set('start_date', query.start_date)
  if (query.end_date) params.set('end_date', query.end_date)
  if (query.granularity) params.set('granularity', query.granularity)
  if (query.vendor_id !== undefined) params.set('vendor_id', String(query.vendor_id))
  if (query.category_id !== undefined) {
    params.set('category_id', String(query.category_id))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const analyticsApi = {
  overview: (query: AnalyticsQuery = {}) =>
    apiRequest<AnalyticsOverview>(`/api/v1/analytics/overview${toQueryString(query)}`),
  distribution: (query: AnalyticsQuery = {}) =>
    apiRequest<PerformanceDistribution>(
      `/api/v1/analytics/performance-distribution${toQueryString(query)}`,
    ),
  ranking: (query: AnalyticsQuery = {}) =>
    apiRequest<VendorRanking>(`/api/v1/analytics/vendor-ranking${toQueryString(query)}`),
  deliveryTrend: (query: AnalyticsQuery = {}) =>
    apiRequest<DeliveryTrend>(`/api/v1/analytics/delivery-trend${toQueryString(query)}`),
  qualityTrend: (query: AnalyticsQuery = {}) =>
    apiRequest<QualityTrend>(`/api/v1/analytics/quality-trend${toQueryString(query)}`),
  incidentTrend: (query: AnalyticsQuery = {}) =>
    apiRequest<IncidentTrend>(`/api/v1/analytics/incident-trend${toQueryString(query)}`),
  severityDistribution: (query: AnalyticsQuery = {}) =>
    apiRequest<IncidentSeverityDistribution>(
      `/api/v1/analytics/incident-severity-distribution${toQueryString(query)}`,
    ),
  performanceTrend: (query: AnalyticsQuery = {}) =>
    apiRequest<PerformanceTrend>(
      `/api/v1/analytics/performance-trend${toQueryString(query)}`,
    ),
  categories: (query: AnalyticsQuery = {}) =>
    apiRequest<CategoryPerformance>(
      `/api/v1/analytics/category-performance${toQueryString(query)}`,
    ),
  comparison: (vendorIds: number[], query: AnalyticsQuery = {}) => {
    const params = new URLSearchParams(toQueryString(query).replace(/^\?/, ''))
    for (const vendorId of vendorIds) {
      params.append('vendor_ids', String(vendorId))
    }
    const value = params.toString()
    return apiRequest<VendorComparison>(
      `/api/v1/analytics/vendor-comparison${value ? `?${value}` : ''}`,
    )
  },
}