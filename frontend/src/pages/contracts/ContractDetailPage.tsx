import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Loader2,
  Pencil,
  IndianRupee,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/common/Modal'
import { ErrorState } from '../../components/common/ErrorState'
import { ContractStatusBadge } from '../../components/contracts/ContractStatusBadge'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { contractsApi } from '../../services/api'
import {
  canManageContracts,
  canManageContractStatus,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
} from '../../utils/permissions'
import { formatCurrency, formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { ContractDetail, ContractStatus } from '../../types'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032] p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-100">{value || '—'}</dd>
    </div>
  )
}

export function ContractDetailPage() {
  const { contractId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const canEdit = canManageContracts(roleName)
  const canChangeStatus = canManageContractStatus(roleName)

  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<ContractStatus>('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    contractsApi
      .get(Number(contractId))
      .then((data) => {
        if (active) {
          setContract(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load contract')
          setContract(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [contractId, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  async function applyStatus(nextStatus: ContractStatus) {
    if (contract == null) return
    setSaving(true)
    try {
      const updated = await contractsApi.updateStatus(contract.id, {
        status: nextStatus,
      })
      setContract(updated)
      setStatusModalOpen(false)
      showToast('Contract status updated', 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update status',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(nextActive: boolean) {
    if (contract == null) return
    setSaving(true)
    try {
      const updated = await contractsApi.update(contract.id, {
        is_active: nextActive,
      })
      setContract(updated)
      showToast(
        nextActive ? 'Contract activated' : 'Contract deactivated',
        'success',
      )
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update contract',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Contracts">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading contract…</span>
        </div>
      </AppLayout>
    )
  }

  if (error || contract == null) {
    return (
      <AppLayout title="Contracts">
        <ErrorState
          message={error ?? 'Contract not found'}
          onRetry={handleRetry}
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Contracts">
      <Link
        to="/contracts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to contracts
      </Link>

      <PageHeader
        title={contract.title}
        subtitle={contract.contract_number}
        actions={
          <>
            {canChangeStatus && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNewStatus(contract.status)
                  setStatusModalOpen(true)
                }}
              >
                Change Status
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => navigate(`/contracts/${contract.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit Contract
              </Button>
            )}
          </>
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <ContractStatusBadge
          status={contract.status}
          inactive={!contract.is_active}
        />
        <span className="text-sm text-slate-500">
          {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Contract Overview">
            <dl>
              <p className="text-sm leading-relaxed text-slate-400">
                Contract <span className="font-mono">{contract.contract_number}</span> with{' '}
                <span className="font-medium text-slate-100">{contract.vendor.company_name}</span>,
                valued at{' '}
                <span className="font-medium text-slate-100">
                  {formatCurrency(contract.contract_value)}
                </span>.
              </p>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Contract number" value={contract.contract_number} />
                <DetailRow label="Status" value={CONTRACT_STATUS_LABELS[contract.status]} />
                <DetailRow label="Account status" value={contract.is_active ? 'Active' : 'Inactive'} />
                <DetailRow label="Contract value" value={formatCurrency(contract.contract_value)} />
                <DetailRow label="Start date" value={formatDate(contract.start_date)} />
                <DetailRow label="End date" value={formatDate(contract.end_date)} />
              </div>
            </dl>
          </Section>

          <Section title="Description">
            <p className="text-sm leading-relaxed text-slate-400">
              {contract.description || 'No description provided for this contract.'}
            </p>
          </Section>

          <Section title="Vendor">
            <Link
              to={`/vendors/${contract.vendor.id}`}
              className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                  {contract.vendor.company_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {contract.vendor.vendor_code}
                </p>
              </div>
            </Link>
          </Section>
        </div>

        <div className="space-y-8">
          <Section title="System Information">
            <dl>
              <DetailRow label="Created" value={new Date(contract.created_at).toLocaleString()} />
              <DetailRow label="Last updated" value={new Date(contract.updated_at).toLocaleString()} />
              <DetailRow label="Contract ID" value={<span className="font-mono text-xs">{contract.id}</span>} />
            </dl>
          </Section>

          <Section title="Contract Period">
            <div className="flex items-start gap-2.5">
              <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow label="Start date" value={formatDate(contract.start_date)} />
                <DetailRow label="End date" value={formatDate(contract.end_date)} />
              </dl>
            </div>
          </Section>

          <Section title="Contract Value">
            <div className="flex items-start gap-2.5">
              <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow label="Contract value" value={formatCurrency(contract.contract_value)} />
                <DetailRow label="Total contract value" value={formatCurrency(contract.contract_value)} />
              </dl>
            </div>
          </Section>

          {canEdit && (
            <Section title="Quick Actions">
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={saving}
                  onClick={async () => {
                    await toggleActive(!contract.is_active)
                  }}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {contract.is_active ? 'Deactivate contract' : 'Activate contract'}
                </Button>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Modal
        open={statusModalOpen}
        title="Change Contract Status"
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || newStatus === contract.status}
              onClick={() => void applyStatus(newStatus)}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Status
            </Button>
          </>
        }
      >
        <label
          htmlFor="status-select"
          className="block text-sm font-medium text-slate-300"
        >
          Status
        </label>
        <select
          id="status-select"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as ContractStatus)}
          className={cn(
            'mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm',
            'text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none',
          )}
        >
          {CONTRACT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {CONTRACT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </Modal>
    </AppLayout>
  )
}