import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

interface Crumb {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: Crumb[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const content = isLast ? (
          <span className="truncate font-medium text-slate-200">{item.label}</span>
        ) : item.to ? (
          <Link
            to={item.to}
            className="truncate text-slate-500 transition-colors hover:text-indigo-300"
          >
            {item.label}
          </Link>
        ) : (
          <span className="truncate text-slate-500">{item.label}</span>
        )
        return (
          <span key={item.label} className="flex min-w-0 items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            )}
            {content}
          </span>
        )
      })}
    </nav>
  )
}