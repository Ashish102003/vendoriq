import { Link } from 'react-router-dom'
import { ArrowRight, Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1120] px-6 text-center text-slate-200">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/50">
        <Compass className="h-7 w-7 text-indigo-300" strokeWidth={1.8} />
      </span>
      <p className="mt-6 text-6xl font-bold tracking-tight text-slate-700">404</p>
      <h2 className="mt-4 text-xl font-semibold text-slate-100">
        Page not found.
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Button className="mt-8" asChild>
        <Link to="/dashboard">
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}