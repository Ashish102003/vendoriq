import { Link } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { Button } from '../ui/Button'

interface ComingSoonProps {
  moduleName: string
}

export function ComingSoon({ moduleName }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/70 bg-[#0e1626]/60 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/50">
        <Construction className="h-7 w-7 text-slate-400" strokeWidth={1.8} />
      </span>
      <h3 className="mt-6 text-lg font-semibold text-slate-100">{moduleName}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        This module is currently under development.
      </p>
      <Button variant="secondary" size="sm" className="mt-8" asChild>
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </Button>
    </div>
  )
}