import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'

interface EmptyStateProps {
  title: string
  message?: string
  actions?: ReactNode
}

export function EmptyState({ title, message, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/50">
        <PackageSearch className="h-6 w-6 text-slate-500" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      </div>
      {actions}
    </div>
  )
}