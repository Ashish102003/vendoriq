import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { ContractForm } from '../../components/contracts/ContractForm'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { contractsApi, vendorsApi } from '../../services/api'
import { canManageContracts } from '../../utils/permissions'
import type { ContractDetail, ContractPayload, VendorListItem } from '../../types'

export function ContractFormPage() {
  const { contractId } = useParams()
  const isEdit = contractId != null
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const allowed = canManageContracts(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [initialValues, setInitialValues] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let active = true
    vendorsApi
      .list({ page_size: 100 })
      .then((data) => {
        if (!active) return
        setVendors(data.items)
        return isEdit ? contractsApi.get(Number(contractId)).catch(() => null) : Promise.resolve(null)
      })
      .then((contract: ContractDetail | null | undefined) => {
        if (!active) return
        if (isEdit && contract === null) {
          setError('Contract not found')
        } else {
          setError(null)
          setInitialValues(contract ?? null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load form')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [allowed, isEdit, contractId])

  const handleSubmit = useCallback(
    async (payload: ContractPayload) => {
      setSubmitting(true)
      const errorDefault = isEdit
        ? 'Failed to update contract'
        : 'Failed to create contract'
      try {
        const contract = isEdit
          ? await contractsApi.update(Number(contractId), payload)
          : await contractsApi.create(payload)
        showToast(
          isEdit
            ? 'Contract updated successfully'
            : 'Contract created successfully',
          'success',
        )
        navigate(`/contracts/${contract.id}`)
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : errorDefault
        showToast(message, 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [isEdit, contractId, navigate, showToast],
  )

  if (!allowed) {
    return (
      <AppLayout title="Contracts">
        <PageHeader title={isEdit ? 'Edit Contract' : 'Add Contract'} />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Access restricted</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your role does not allow creating or editing contracts.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Contracts">
      <PageHeader
        title={isEdit ? 'Edit Contract' : 'Add Contract'}
        subtitle={
          isEdit
            ? 'Update the contract details below.'
            : 'Create a new contractual agreement with a vendor.'
        }
      />
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => navigate('/contracts')}
        />
      ) : loading ? (
        <div className="iq-card flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        vendors.length > 0 && (
          <ContractForm
            key={initialValues?.id ?? 'new'}
            initialValues={initialValues}
            vendors={vendors}
            roleName={roleName}
            submitLabel={isEdit ? 'Save Changes' : 'Create Contract'}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        )
      )}
      {!error && !loading && vendors.length === 0 && (
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">No vendors are available</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a vendor before creating a contract.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate('/vendors/new')}>
              Add Vendor
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}