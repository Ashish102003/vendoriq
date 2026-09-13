import { VENDOR_STATUS_LABELS } from '../../utils/permissions'
import type { VendorStatus } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const statusTones: Record<VendorStatus, BadgeTone> = {
  PENDING: 'amber',
  ACTIVE: 'emerald',
  UNDER_REVIEW: 'sky',
  SUSPENDED: 'orange',
  TERMINATED: 'red',
}

export function VendorStatusBadge({
  status,
  inactive = false,
}: {
  status: VendorStatus
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
      {VENDOR_STATUS_LABELS[status]}
    </StatusBadge>
  )
}