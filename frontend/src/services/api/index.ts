import { apiRequest } from './client'
import type {
  AuthUser,
  HealthStatus,
  LoginRequest,
  LoginResponse,
} from '../../types'

export const healthApi = {
  getStatus: () => apiRequest<HealthStatus>('/api/v1/health'),
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: data,
    }),
  me: () => apiRequest<AuthUser>('/api/v1/auth/me'),
}

export { vendorsApi } from './vendors'
export { vendorCategoriesApi } from './vendorCategories'
export { contractsApi } from './contracts'
export { purchaseOrdersApi, vendorOperationsApi } from './purchaseOrders'
export {
  qualityEvaluationsApi,
  vendorQualityApi,
} from './qualityEvaluations'
export {
  incidentsApi,
  vendorIncidentsApi,
} from './incidents'
export { usersApi } from './users'
export { vendorPerformanceApi } from './vendorPerformance'
export { analyticsApi } from './analytics'
export { vendorRiskApi } from './vendorRisk'