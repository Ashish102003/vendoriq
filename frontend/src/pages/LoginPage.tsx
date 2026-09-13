import { ShieldCheck } from 'lucide-react'
import { LoginForm } from '../components/auth/LoginForm'
import { LoginVisual } from '../components/auth/LoginVisual'

/**
 * Premium split-screen login page (UI redesign part 1, layout refinement).
 *
 * Desktop: left visual area carries the brand headline on the central-left
 * with the animated laptop dashboard as the centerpiece (shifted rightward so
 * the whole screen feels balanced); right is the sign-in panel. On mobile the
 * laptop stacks above the form. Auth behaviour is unchanged.
 */
export function LoginPage() {
  return (
    <div className="grid min-h-screen bg-[#0b1220] text-slate-200 lg:h-screen lg:grid-cols-[1.6fr_1fr]">
      {/* LEFT — headline + laptop preview */}
      <section className="relative hidden flex-col overflow-hidden bg-[#0d1526] md:flex">
        <div
          className="iq-login-grid pointer-events-none absolute inset-0"
          aria-hidden="true"
        />
        <div
          className="iq-glow-drift pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0b1220]/70 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1280px] items-center gap-8 px-8 lg:gap-10 lg:px-12 xl:gap-12">
          <div className="w-64 max-w-xs shrink-0 xl:w-72 2xl:w-80">
            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Real-time vendor insights
            </span>
            <h2 className="mt-4 text-3xl leading-tight font-bold tracking-tight text-white lg:text-4xl xl:text-[40px]">
              Vendor Intelligence
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Monitor vendor performance, delivery, and risk across your vendor
              base with clear, decisive insights.
            </p>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <LoginVisual />
          </div>
        </div>
      </section>

      {/* MOBILE — stacked: brand, headline, small laptop, then the form below */}
      <section className="flex flex-col items-center bg-[#0d1526] px-6 pt-8 pb-6 md:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/40">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">VendorIQ</p>
            <p className="text-[10px] text-slate-400">Enterprise Suite</p>
          </div>
        </div>

        <h2 className="mt-6 text-center text-2xl leading-tight font-bold tracking-tight text-white">
          Vendor Intelligence
        </h2>

        <div className="mt-8 w-full max-w-[340px]">
          <LoginVisual />
        </div>
      </section>

      {/* RIGHT — sign-in */}
      <section className="relative flex flex-col items-center justify-center px-6 py-10 sm:px-10 lg:border-l lg:border-slate-800/80 lg:py-12 lg:overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"
          aria-hidden="true"
        />

        {/* desktop/tablet brand — the laptop headline covers this side's role on mobile */}
        <div className="hidden w-full max-w-sm items-center gap-2.5 md:mb-10 md:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/40">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">VendorIQ</p>
            <p className="text-[10px] text-slate-400">Enterprise Suite</p>
          </div>
        </div>

        <LoginForm />
      </section>
    </div>
  )
}