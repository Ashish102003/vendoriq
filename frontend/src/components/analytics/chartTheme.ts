export const CLASSIFICATION_COLORS: Record<string, string> = {
  EXCELLENT: '#34d399',
  GOOD: '#4ade80',
  AVERAGE: '#fbbf24',
  POOR: '#fb923c',
  CRITICAL: '#f87171',
  INSUFFICIENT_DATA: '#64748b',
}

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#fbbf24',
  HIGH: '#fb923c',
  CRITICAL: '#f87171',
}

export const TREND_COLORS = {
  delivery: '#818cf8',
  quality: '#34d399',
  incident: '#fbbf24',
  performance: '#a78bfa',
  comparisonOverall: '#818cf8',
  comparisonDelivery: '#38bdf8',
  comparisonQuality: '#34d399',
  comparisonIncident: '#fbbf24',
}

/** Shared recharts theme for dark workspace surfaces. */
export const chartGrid = '#1e293b'
export const chartAxisTick = '#64748b'
export const chartAxisLine = '#334155'
export const chartTooltipStyle = {
  background: '#0f1729',
  border: '1px solid #334155',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#e2e8f0',
}
export const chartCursor = { stroke: '#475569', strokeDasharray: '4 4' }