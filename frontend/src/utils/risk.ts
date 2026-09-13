import type { RiskConfidence, RiskLevel, RiskTrend } from '../types'

export const RISK_LEVELS: RiskLevel[] = [
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  VERY_LOW: 'Very Low',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const RISK_LEVEL_STYLES: Record<RiskLevel, string> = {
  VERY_LOW: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  LOW: 'bg-green-500/10 text-green-300 border-green-500/25',
  MEDIUM: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  HIGH: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
  CRITICAL: 'bg-red-500/10 text-red-300 border-red-500/25',
}

export function riskScoreColor(score: number): string {
  if (score <= 20) return '#059669'
  if (score <= 40) return '#16a34a'
  if (score <= 60) return '#d97706'
  if (score <= 80) return '#ea580c'
  return '#dc2626'
}

export const RISK_CONFIDENCE_LABELS: Record<RiskConfidence, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export const RISK_TREND_LABELS: Record<RiskTrend, string> = {
  IMPROVING: 'Improving',
  STABLE: 'Stable',
  WORSENING: 'Worsening',
  INSUFFICIENT_DATA: 'Insufficient Data',
}

export const RISK_TREND_STYLES: Record<RiskTrend, string> = {
  IMPROVING: 'text-emerald-300',
  STABLE: 'text-slate-400',
  WORSENING: 'text-red-300',
  INSUFFICIENT_DATA: 'text-slate-500',
}