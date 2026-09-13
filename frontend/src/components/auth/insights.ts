export type InsightTone = 'neutral' | 'positive' | 'warning' | 'danger'

/** Which mini-dashboard visual the current message should "activate". */
export type InsightFocus = 'performance' | 'delivery' | 'risk'

/** How long each live-intelligence message stays on screen. */
export const INSIGHT_MS = 5100

export interface InsightMessage {
  text: string
  tone: InsightTone
  focus: InsightFocus
}

/**
 * The rotating intelligence messages shown under the laptop. Each message is
 * tied to a dashboard visual so the preview reacts like it is processing data.
 */
export const INSIGHTS: InsightMessage[] = [
  { text: '3 vendors exceeding expectations', tone: 'positive', focus: 'performance' },
  { text: 'Delivery performance improving', tone: 'positive', focus: 'delivery' },
  { text: 'Vendor risk under control', tone: 'neutral', focus: 'risk' },
  { text: 'Operational health remains stable', tone: 'positive', focus: 'delivery' },
  { text: 'Vendor analysis updated', tone: 'neutral', focus: 'performance' },
]

/** Slowly changing risk scores aligned with the message cycle. */
export const RISK_SCORES = [31, 30, 29, 32, 34]