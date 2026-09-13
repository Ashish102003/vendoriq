import { INCIDENT_STATUS_LABELS } from '../../utils/permissions'
import type { IncidentStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<IncidentStatus, BadgeTone> = {
  OPEN: 'blue',
  IN_PROGRESS: 'amber',
  RESOLVED: 'green',
  CLOSED: 'slate',
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <StatusBadge tone={statusTones[status]} dot>
      {INCIDENT_STATUS_LABELS[status]}
    </StatusBadge>
  )
}