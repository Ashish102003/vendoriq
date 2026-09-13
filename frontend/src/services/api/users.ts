import { apiRequest } from './client'
import type { UserListItem } from '../../types'

export const usersApi = {
  list: () => apiRequest<UserListItem[]>('/api/v1/users'),
}