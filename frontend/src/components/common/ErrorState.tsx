import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'

interface ErrorStateProps {
  message: string
  /** When set, shows a "Try Again" action. */
  onRetry?: () => void
  title?: string
}

export function ErrorState({ message, onRetry, title }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-200">
          {title ?? 'Something went wrong'}
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}