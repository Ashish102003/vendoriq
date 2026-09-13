import { INCIDENT_SEVERITY_LABELS } from '../../utils/permissions'
import type { IncidentSeverity } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const severityTones: Record<IncidentSeverity, BadgeTone> = {
  LOW: 'slate',
  MEDIUM: 'amber',
  HIGH: 'orange',
  CRITICAL: 'red',
}

export function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <StatusBadge tone={severityTones[severity]} dot>
      {INCIDENT_SEVERITY_LABELS[severity]}
    </StatusBadge>
  )
}