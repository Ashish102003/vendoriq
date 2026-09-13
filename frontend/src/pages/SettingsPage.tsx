import { Check, Database, Info, Monitor, Palette, Shield, User } from 'lucide-react'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/common/PageHeader'
import { card } from '../styles/classes'
import { useAuth } from '../context/auth-context'
import {
  canCreateVendor,
  canManageCategories,
  canManageContracts,
  canManageIncidents,
  canManagePurchaseOrders,
  canManageQualityEvaluations,
  canManageVendorStatus,
  canRecordDelivery,
} from '../utils/permissions'

interface Capability {
  label: string
  enabled: boolean
}

function SectionCard({
  title,
  icon,
  iconClass,
  children,
}: {
  title: string
  icon: React.ReactNode
  iconClass: string
  children: React.ReactNode
}) {
  return (
    <div className={card}>
      <div className="flex items-center gap-3 border-b border-slate-800/70 px-5 py-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconClass}`}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const roleName = user?.role.name ?? ''

  const capabilities: Capability[] = [
    { label: 'Create and edit vendor profiles', enabled: canCreateVendor(roleName) },
    { label: 'Manage vendor status changes', enabled: canManageVendorStatus(roleName) },
    { label: 'Manage vendor categories', enabled: canManageCategories(roleName) },
    { label: 'Create and edit contracts', enabled: canManageContracts(roleName) },
    { label: 'Create and edit purchase orders', enabled: canManagePurchaseOrders(roleName) },
    { label: 'Record delivery status', enabled: canRecordDelivery(roleName) },
    { label: 'Create and edit quality evaluations', enabled: canManageQualityEvaluations(roleName) },
    { label: 'Create and edit incidents', enabled: canManageIncidents(roleName) },
  ]

  const initials =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').slice(0, 2) ||
    (user?.first_name?.[0] ?? '?')

  return (
    <AppLayout title="Settings">
      <PageHeader
        title="Settings"
        subtitle="Workspace profile, role capabilities and platform information."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="My Profile"
          icon={<User className="h-4.5 w-4.5" />}
          iconClass="border-slate-700/60 bg-slate-800/50 text-slate-400"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-300 ring-1 ring-indigo-500/30">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="truncate text-sm text-slate-400">{user?.email}</p>
              <p className="mt-0.5 text-xs text-slate-500">{roleName}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Appearance"
          icon={<Palette className="h-4.5 w-4.5" />}
          iconClass="border-indigo-500/25 bg-indigo-500/10 text-indigo-300"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Dark workspace</p>
              <p className="mt-0.5 text-xs text-slate-500">
                VendorIQ is built as a dark-first intelligence workspace for
                dense operational data.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/40 px-2.5 py-1 text-xs font-medium text-slate-200">
              <Monitor className="h-3.5 w-3.5" />
              Dark
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title="Role & Permissions"
          icon={<Shield className="h-4.5 w-4.5" />}
          iconClass="border-amber-500/25 bg-amber-500/10 text-amber-300"
        >
          <ul className="space-y-2">
            {capabilities.map((capability) => (
              <li key={capability.label} className="flex items-center gap-2.5">
                <span
                  className={
                    capability.enabled
                      ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300'
                      : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800/60 text-slate-600'
                  }
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span
                  className={
                    capability.enabled
                      ? 'text-sm text-slate-200'
                      : 'text-sm text-slate-500'
                  }
                >
                  {capability.label}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-8">
          <SectionCard
            title="Platform"
            icon={<Info className="h-4.5 w-4.5" />}
            iconClass="border-sky-500/25 bg-sky-500/10 text-sky-300"
          >
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Product</dt>
                <dd className="text-slate-200">VendorIQ Enterprise Suite</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Environment</dt>
                <dd className="uppercase text-slate-400">
                  {import.meta.env.MODE}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Data & Intelligence"
            icon={<Database className="h-4.5 w-4.5" />}
            iconClass="border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          >
            <p className="text-sm text-slate-400">
              Performance scoring, risk predictions and insights are computed
              server-side from live vendor, contract, purchase order, delivery,
              quality and incident records.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Review the prediction model details and current signals in AI
              Insights.
            </p>
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  )
}