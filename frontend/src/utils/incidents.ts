import type { IncidentStatus } from '../types'

export const ALLOWED_INCIDENT_STATUS_TRANSITIONS: Record<
  IncidentStatus,
  IncidentStatus[]
> = {
  OPEN: ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['RESOLVED', 'CLOSED'],
  CLOSED: [],
}

export function isOverdue(
  status: IncidentStatus,
  dueDate: string | null,
): boolean {
  if (!dueDate) return false
  if (status !== 'OPEN' && status !== 'IN_PROGRESS') return false
  return new Date(dueDate).getTime() < Date.now()
}