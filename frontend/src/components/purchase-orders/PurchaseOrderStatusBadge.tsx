import { PURCHASE_ORDER_STATUS_LABELS } from '../../utils/permissions'
import type { PurchaseOrderStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: 'amber',
  ISSUED: 'sky',
  IN_PROGRESS: 'blue',
  DELIVERED: 'emerald',
  PARTIALLY_DELIVERED: 'teal',
  CANCELLED: 'red',
  CLOSED: 'slate',
}

export function PurchaseOrderStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus
}) {
  return (
    <StatusBadge tone={statusTones[status]} dot>
      {PURCHASE_ORDER_STATUS_LABELS[status]}
    </StatusBadge>
  )
}