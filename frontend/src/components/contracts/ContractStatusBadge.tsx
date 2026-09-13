import { CONTRACT_STATUS_LABELS } from '../../utils/permissions'
import type { ContractStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<ContractStatus, BadgeTone> = {
  DRAFT: 'amber',
  ACTIVE: 'emerald',
  COMPLETED: 'sky',
  ON_HOLD: 'orange',
  CANCELLED: 'red',
  EXPIRED: 'slate',
}

export function ContractStatusBadge({
  status,
  inactive = false,
}: {
  status: ContractStatus
  inactive?: boolean
}) {
  if (inactive) {
    return (
      <StatusBadge tone="slate" dot>
        Inactive
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={statusTones[status]} dot>
      {CONTRACT_STATUS_LABELS[status]}
    </StatusBadge>
  )
}