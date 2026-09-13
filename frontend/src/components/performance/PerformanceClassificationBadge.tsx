import { PERFORMANCE_CLASSIFICATION_LABELS } from '../../utils/permissions'
import type { VendorPerformanceClassification } from '../../types'
import { StatusBadge, type BadgeTone } from '../common/StatusBadge'

const classificationTones: Record<VendorPerformanceClassification, BadgeTone> = {
  EXCELLENT: 'emerald',
  GOOD: 'green',
  AVERAGE: 'amber',
  POOR: 'orange',
  CRITICAL: 'red',
  INSUFFICIENT_DATA: 'slate',
}

export function PerformanceClassificationBadge({
  classification,
}: {
  classification: VendorPerformanceClassification
}) {
  return (
    <StatusBadge tone={classificationTones[classification]} dot>
      {PERFORMANCE_CLASSIFICATION_LABELS[classification]}
    </StatusBadge>
  )
}