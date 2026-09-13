import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type BadgeTone =
  | 'neutral'
  | 'slate'
  | 'indigo'
  | 'sky'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'green'
  | 'amber'
  | 'orange'
  | 'red'

interface StatusBadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** Render a small colored status dot before the label. */
  dot?: boolean
  className?: string
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
  slate: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
  indigo: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
  sky: 'bg-sky-500/10 border-sky-500/25 text-sky-300',
  blue: 'bg-blue-500/10 border-blue-500/25 text-blue-300',
  teal: 'bg-teal-500/10 border-teal-500/25 text-teal-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  green: 'bg-green-500/10 border-green-500/25 text-green-300',
  amber: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  orange: 'bg-orange-500/10 border-orange-500/25 text-orange-300',
  red: 'bg-red-500/10 border-red-500/25 text-red-300',
}

const DOT_COLORS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  slate: 'bg-slate-400',
  indigo: 'bg-indigo-400',
  sky: 'bg-sky-400',
  blue: 'bg-blue-400',
  teal: 'bg-teal-400',
  emerald: 'bg-emerald-400',
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_COLORS[tone])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}