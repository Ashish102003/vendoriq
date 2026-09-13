import { QUALITY_STATUS_LABELS } from '../../utils/permissions'
import type { QualityStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<QualityStatus, BadgeTone> = {
  EXCELLENT: 'emerald',
  GOOD: 'green',
  ACCEPTABLE: 'blue',
  POOR: 'amber',
  CRITICAL: 'red',
}

export function QualityStatusBadge({ status }: { status: QualityStatus }) {
  return (
    <StatusBadge tone={statusTones[status]} dot>
      {QUALITY_STATUS_LABELS[status]}
    </StatusBadge>
  )
}