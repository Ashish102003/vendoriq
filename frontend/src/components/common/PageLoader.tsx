import { Loader2 } from 'lucide-react'

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      <p className="text-sm">{label}</p>
    </div>
  )
}