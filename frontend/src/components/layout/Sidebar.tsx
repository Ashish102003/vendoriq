import { NavLink } from 'react-router-dom'
import { ShieldCheck, X } from 'lucide-react'
import { NAV_GROUPS } from './navigation'
import { cn } from '../../utils/cn'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const renderContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-800/80 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-indigo-950/40">
          <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-slate-100">VendorIQ</p>
          <p className="text-[10px] font-medium tracking-wide text-slate-500">
            Enterprise Suite
          </p>
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && 'pt-5')}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, path, icon: Icon }) => (
                <li key={label}>
                  <NavLink
                    to={path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-200'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400 transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden="true"
                        />
                        <Icon
                          className={cn(
                            'h-[17px] w-[17px] shrink-0 transition-colors',
                            isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300',
                          )}
                          strokeWidth={1.9}
                        />
                        <span className="truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800/80 px-5 py-4">
        <p className="text-[11px] font-semibold text-slate-500">VendorIQ</p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Enterprise Intelligence Platform
        </p>
      </div>
    </>
  )

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/80 bg-[#0d1524] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {renderContent()}
      </aside>
    </>
  )
}