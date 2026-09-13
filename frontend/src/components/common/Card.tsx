import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CardProps {
  title?: ReactNode
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  padded?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  padded = true,
}: CardProps) {
  return (
    <section className={cn('iq-card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 px-5 py-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded ? 'p-5' : '', bodyClassName)}>{children}</div>
    </section>
  )
}