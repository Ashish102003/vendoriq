import { DELIVERY_STATUS_LABELS } from '../../utils/permissions'
import type { DeliveryStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<DeliveryStatus, BadgeTone> = {
  PENDING: 'slate',
  ON_TIME: 'emerald',
  DELAYED: 'red',
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <StatusBadge tone={statusTones[status]} dot>
      {DELIVERY_STATUS_LABELS[status]}
    </StatusBadge>
  )
}