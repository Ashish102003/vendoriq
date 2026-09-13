import type { QualityStatus } from '../types'

export function expectedQualityStatus(score: number): QualityStatus {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 60) return 'ACCEPTABLE'
  if (score >= 40) return 'POOR'
  return 'CRITICAL'
}