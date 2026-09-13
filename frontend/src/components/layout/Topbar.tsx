import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Menu } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { Breadcrumbs } from '../common/Breadcrumbs'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsMenu } from './NotificationsMenu'

interface TopbarProps {
  onMenuClick: () => void
}

const ROUTE_MAP: Record<string, { label: string; section?: { label: string; to: string } }> = {
  '/dashboard': { label: 'Dashboard' },
  '/analytics': { label: 'Advanced Analytics', section: { label: 'Overview', to: '/dashboard' } },
  '/vendor-risk': { label: 'Risk Center', section: { label: 'Overview', to: '/dashboard' } },
  '/ai-insights': { label: 'AI Insights', section: { label: 'Intelligence', to: '/dashboard' } },
  '/settings': { label: 'Settings' },
  '/vendors': { label: 'Vendors' },
  '/vendor-performance': { label: 'Vendor Performance', section: { label: 'Vendors', to: '/vendors' } },
  '/vendor-categories': { label: 'Vendor Categories', section: { label: 'Vendors', to: '/vendors' } },
  '/contracts': { label: 'Contracts' },
  '/purchase-orders': { label: 'Purchase Orders' },
  '/quality-evaluations': { label: 'Quality Evaluations' },
  '/incidents': { label: 'Incidents' },
}

function toCrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length >= 2 && segments[0] === 'coming-soon' && segments[1]) {
    return [{ label: decodeURIComponent(segments[1]) }]
  }

  if (segments.length >= 2 && segments[0] === 'vendors') {
    const crumbs: { label: string; to?: string }[] = [{ label: 'Vendors', to: '/vendors' }]
    if (segments[1] === 'new') crumbs.push({ label: 'New Vendor' })
    else if (segments[2] === 'edit') crumbs.push({ label: 'Edit Vendor' })
    else if (!Number.isNaN(Number(segments[1]))) crumbs.push({ label: 'Vendor Profile' })
    return crumbs
  }

  if (segments.length >= 2 && segments[0] === 'contracts') {
    const crumbs: { label: string; to?: string }[] = [{ label: 'Contracts', to: '/contracts' }]
    if (segments[1] === 'new') crumbs.push({ label: 'New Contract' })
    else if (segments[2] === 'edit') crumbs.push({ label: 'Edit Contract' })
    else if (!Number.isNaN(Number(segments[1]))) crumbs.push({ label: 'Contract Detail' })
    return crumbs
  }

  if (segments.length >= 2 && segments[0] === 'purchase-orders') {
    const crumbs: { label: string; to?: string }[] = [{ label: 'Purchase Orders', to: '/purchase-orders' }]
    if (segments[1] === 'new') crumbs.push({ label: 'New Purchase Order' })
    else if (segments[2] === 'edit') crumbs.push({ label: 'Edit Purchase Order' })
    else if (!Number.isNaN(Number(segments[1]))) crumbs.push({ label: 'Purchase Order Detail' })
    return crumbs
  }

  if (segments.length >= 2 && segments[0] === 'quality-evaluations') {
    const crumbs: { label: string; to?: string }[] = [{ label: 'Quality Evaluations', to: '/quality-evaluations' }]
    if (segments[1] === 'new') crumbs.push({ label: 'New Evaluation' })
    else if (segments[2] === 'edit') crumbs.push({ label: 'Edit Evaluation' })
    else if (!Number.isNaN(Number(segments[1]))) crumbs.push({ label: 'Evaluation Detail' })
    return crumbs
  }

  if (segments.length >= 2 && segments[0] === 'incidents') {
    const crumbs: { label: string; to?: string }[] = [{ label: 'Incidents', to: '/incidents' }]
    if (segments[1] === 'new') crumbs.push({ label: 'New Incident' })
    else if (segments[2] === 'edit') crumbs.push({ label: 'Edit Incident' })
    else if (!Number.isNaN(Number(segments[1]))) crumbs.push({ label: 'Incident Detail' })
    return crumbs
  }

  if (segments.length === 0) return [{ label: 'Welcome' }]

  const entry = ROUTE_MAP[`/${segments[0]}`]
  if (!entry) return [{ label: segments[0].replace(/-/g, ' ') }]

  return entry.section
    ? [
        { label: entry.section.label, to: entry.section.to },
        { label: entry.label },
      ]
    : [{ label: entry.label }]
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user
    ? `${user.first_name.charAt(0) ?? ''}${user.last_name.charAt(0) ?? ''}`.toUpperCase()
    : 'U'

  function handleLogout() {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-800/80 bg-[#0e1626]/90 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden h-4 w-px bg-slate-800 lg:block" />

      <Breadcrumbs items={toCrumbs(location.pathname)} />

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />

        <div className="hidden h-6 w-px bg-slate-800 md:block" />

        <NotificationsMenu />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="User profile"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.05]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white ring-1 ring-white/10">
              {initials}
            </span>
            <span className="hidden text-left md:block">
              <span className="block text-sm leading-tight font-medium text-slate-100">
                {user ? `${user.first_name} ${user.last_name}` : 'Account'}
              </span>
              <span className="block text-[11px] leading-tight text-slate-500">
                {user?.role.name ?? ''}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-500 md:block" />
          </button>

          {menuOpen && user && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 rounded-lg border border-slate-700/80 bg-[#121a2b] shadow-xl shadow-black/40"
            >
              <div className="border-b border-slate-800/80 px-4 py-3">
                <p className="text-sm font-medium text-slate-100">
                  {user.first_name} {user.last_name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                <span className="mt-2 inline-flex items-center rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  {user.role.name}
                </span>
              </div>
              <div className="py-1">
                <Link
                  to="/dashboard"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-slate-100"
                >
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 border-t border-slate-800/80 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}