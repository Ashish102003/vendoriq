import { BarChart3 } from 'lucide-react'

export function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <BarChart3 className="h-6 w-6 text-slate-600" />
      <p className="text-xs text-slate-500">
        {message ?? 'Not enough historical data to display a trend.'}
      </p>
    </div>
  )
}