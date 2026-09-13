import { apiRequest } from './client'
import type {
  VendorCategoryPayload,
  VendorCategoryUpdatePayload,
  VendorCategoryWithCount,
} from '../../types'

interface ListQuery {
  include_inactive?: boolean
  search?: string
}

export const vendorCategoriesApi = {
  list: (query: ListQuery = {}) => {
    const params = new URLSearchParams()
    if (query.include_inactive)
      params.set('include_inactive', 'true')
    if (query.search) params.set('search', query.search)
    const value = params.toString()
    return apiRequest<VendorCategoryWithCount[]>(
      `/api/v1/vendor-categories${value ? `?${value}` : ''}`,
    )
  },
  create: (payload: VendorCategoryPayload) =>
    apiRequest<VendorCategoryWithCount>('/api/v1/vendor-categories', {
      method: 'POST',
      body: payload,
    }),
  update: (id: number, payload: VendorCategoryUpdatePayload) =>
    apiRequest<VendorCategoryWithCount>(`/api/v1/vendor-categories/${id}`, {
      method: 'PATCH',
      body: payload,
    }),
}