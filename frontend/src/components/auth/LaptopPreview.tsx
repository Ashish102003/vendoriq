import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface LaptopPreviewProps {
  /** The IntelligenceDashboard rendered inside the screen. */
  children: ReactNode
  className?: string
}

/**
 * CSS-built premium laptop (no images):
 *  - dark metallic outer bezel with a visible top bezel strip + webcam dot
 *  - thin bright display frame wrapping the dashboard
 *  - thicker bottom screen edge with an engraved wordmark
 *  - recognizable angled base with a subtle trackpad hint and grounding shadow
 *  - gentle perspective (`iq-laptop`) and a very slow float (`iq-float`)
 */
export function LaptopPreview({ children, className }: LaptopPreviewProps) {
  return (
    <div className={cn('iq-float w-full max-w-[680px]', className)}>
      <div className="iq-laptop relative w-full">
        {/* display + bezel */}
        <div className="iq-laptop-screen relative px-2 pt-2 pb-3">
          <div className="relative mb-1.5 flex items-center justify-center" aria-hidden="true">
            <span className="h-1 w-1 rounded-full bg-slate-500/90 shadow-[0_0_3px_rgba(148,163,184,0.5)]" />
          </div>

          <div className="relative overflow-hidden rounded-[8px] bg-[#0a1220] shadow-[inset_0_0_24px_rgba(0,0,0,0.55)] ring-1 ring-black/80">
            <div className="aspect-[16/10] min-h-0">{children}</div>
          </div>
        </div>

        {/* bottom screen edge */}
        <div className="flex h-4 items-center justify-center rounded-b-[10px] border-t border-slate-700/40 bg-slate-900/95">
          <span className="text-[6px] font-medium tracking-[0.4em] text-slate-600">
            VENDORIQ
          </span>
        </div>

        {/* hinge + angled base with trackpad hint */}
        <div className="mx-[7%] -mt-px h-1 rounded-b-sm bg-slate-800" />
        <div className="iq-laptop-base relative mx-[3%] h-4 rounded-b-[4px]">
          <span
            className="absolute top-[60%] left-1/2 h-1 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-slate-800/70"
            aria-hidden="true"
          />
        </div>
        <div className="mx-[8%] h-2 rounded-b-xl bg-slate-950/90" />
      </div>
    </div>
  )
}