import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { QualityEvaluationForm } from '../../components/quality-evaluations/QualityEvaluationForm'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { qualityEvaluationsApi, vendorsApi } from '../../services/api'
import { canManageQualityEvaluations } from '../../utils/permissions'
import type {
  QualityEvaluationDetail,
  QualityEvaluationPayload,
  VendorListItem,
} from '../../types'

export function QualityEvaluationFormPage() {
  const { evaluationId } = useParams()
  const isEdit = evaluationId != null
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const allowed = canManageQualityEvaluations(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [initialValues, setInitialValues] = useState<QualityEvaluationDetail | null>(null)
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
        return isEdit
          ? qualityEvaluationsApi.get(Number(evaluationId)).catch(() => null)
          : Promise.resolve(null)
      })
      .then((evaluation: QualityEvaluationDetail | null | undefined) => {
        if (!active) return
        if (isEdit && evaluation === null) {
          setError('Quality evaluation not found')
        } else {
          setError(null)
          setInitialValues(evaluation ?? null)
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
  }, [allowed, isEdit, evaluationId])

  const handleSubmit = useCallback(
    async (payload: QualityEvaluationPayload) => {
      setSubmitting(true)
      const errorDefault = isEdit
        ? 'Failed to update quality evaluation'
        : 'Failed to create quality evaluation'
      try {
        const evaluation = isEdit
          ? await qualityEvaluationsApi.update(Number(evaluationId), payload)
          : await qualityEvaluationsApi.create(payload)
        showToast(
          isEdit
            ? 'Quality evaluation updated successfully'
            : 'Quality evaluation recorded successfully',
          'success',
        )
        navigate(`/quality-evaluations/${evaluation.id}`)
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : errorDefault
        showToast(message, 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [isEdit, evaluationId, navigate, showToast],
  )

  if (!allowed) {
    return (
      <AppLayout title="Quality Evaluations">
        <PageHeader title={isEdit ? 'Edit Quality Evaluation' : 'Record Quality Evaluation'} />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Access restricted</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your role does not allow creating or editing quality evaluations.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Quality Evaluations">
      <PageHeader
        title={isEdit ? 'Edit Quality Evaluation' : 'Record Quality Evaluation'}
        subtitle={
          isEdit
            ? 'Update the evaluation details below.'
            : 'Record a new evaluation to monitor vendor quality performance.'
        }
      />
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => navigate('/quality-evaluations')}
        />
      ) : loading ? (
        <div className="iq-card flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        vendors.length > 0 && (
          <QualityEvaluationForm
            key={initialValues?.id ?? 'new'}
            initialValues={initialValues}
            vendors={vendors}
            submitLabel={isEdit ? 'Save Changes' : 'Record Evaluation'}
            isSubmitting={submitting}
            onSubmit={handleSubmit}
          />
        )
      )}
      {!error && !loading && vendors.length === 0 && (
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">No vendors are available</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a vendor before recording a quality evaluation.
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