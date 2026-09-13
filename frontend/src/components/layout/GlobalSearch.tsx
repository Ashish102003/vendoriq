import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { vendorsApi } from '../../services/api'
import type { VendorListItem } from '../../types'

export function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VendorListItem[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < 2) return

    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      vendorsApi
        .list({ search: term, page_size: 6 })
        .then((res) => {
          if (active) setResults(res.items)
        })
        .catch(() => {
          if (active) setResults([])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, open])

  function close() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  function goToVendor(id: number) {
    close()
    navigate(`/vendors/${id}`)
  }

  const term = query.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 text-left text-sm text-slate-500 transition-colors hover:border-slate-700 hover:bg-slate-800/70 md:flex xl:w-72"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search vendors, contracts, or insights…</span>
        <kbd className="ml-auto shrink-0 rounded border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          Ctrl K
        </kbd>
      </button>

      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 md:hidden"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 pt-24 backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700/80 bg-[#121a2b] shadow-2xl shadow-black/50"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (event.target.value.trim().length < 2) setResults([])
                }}
                placeholder="Search vendors by name or code…"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              ) : (
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={close}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2.5">
              {term.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  Type at least two characters to search the vendor directory.
                </p>
              ) : results.length === 0 && !loading ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  No vendors match “{term}”.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {results.map((vendor) => (
                    <li key={vendor.id}>
                      <button
                        type="button"
                        onClick={() => goToVendor(vendor.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/60 text-[11px] font-bold text-slate-300">
                          {vendor.company_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-100">
                            {vendor.company_name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {vendor.vendor_code}
                            {vendor.category?.name ? ` · ${vendor.category.name}` : ''}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-2.5 text-[11px] text-slate-500">
              <span>
                <kbd className="rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5">Esc</kbd>{' '}
                to close
              </span>
              <button
                type="button"
                onClick={() => {
                  close()
                  navigate('/vendors')
                }}
                className="font-medium text-indigo-300 transition-colors hover:text-indigo-200"
              >
                View all vendors
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}