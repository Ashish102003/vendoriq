import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AppLayoutProps {
  children: ReactNode
  /**
   * @deprecated The topbar now renders breadcrumbs derived from the route.
   * Kept for backwards compatibility with existing pages.
   */
  title?: string
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#0b1120] text-slate-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pt-10 pb-20 sm:px-6 lg:px-9 xl:px-12">
          {children}
        </main>
      </div>
    </div>
  )
}