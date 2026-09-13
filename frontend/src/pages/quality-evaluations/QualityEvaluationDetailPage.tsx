import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  ClipboardCheck,
  FileText,
  Loader2,
  Pencil,
  Package,
  Star,
} from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/common/ErrorState'
import { QualityStatusBadge } from '../../components/quality-evaluations/QualityStatusBadge'
import { useAuth } from '../../context/auth-context'
import { qualityEvaluationsApi } from '../../services/api'
import { canManageQualityEvaluations, QUALITY_STATUS_LABELS } from '../../utils/permissions'
import { formatDate } from '../../utils/format'
import type { QualityEvaluationDetail } from '../../types'

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

export function QualityEvaluationDetailPage() {
  const { evaluationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const roleName = user?.role.name ?? ''
  const canEdit = canManageQualityEvaluations(roleName)

  const [evaluation, setEvaluation] = useState<QualityEvaluationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    qualityEvaluationsApi
      .get(Number(evaluationId))
      .then((data) => {
        if (active) {
          setEvaluation(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load quality evaluation')
          setEvaluation(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [evaluationId, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  if (loading) {
    return (
      <AppLayout title="Quality Evaluations">
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading quality evaluation…</span>
        </div>
      </AppLayout>
    )
  }

  if (error || evaluation == null) {
    return (
      <AppLayout title="Quality Evaluations">
        <ErrorState
          message={error ?? 'Quality evaluation not found'}
          onRetry={handleRetry}
        />
      </AppLayout>
    )
  }

  const reference = evaluation.purchase_order
    ? { label: evaluation.purchase_order.order_number, id: evaluation.purchase_order.id }
    : evaluation.contract
      ? { label: evaluation.contract.contract_number, id: evaluation.contract.id }
      : null

  return (
    <AppLayout title="Quality Evaluations">
      <Link
        to="/quality-evaluations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quality evaluations
      </Link>

      <PageHeader
        title="Quality Evaluation"
        subtitle={`${evaluation.vendor.company_name} · ${formatDate(evaluation.evaluation_date)}`}
        actions={
          canEdit ? (
            <Button onClick={() => navigate(`/quality-evaluations/${evaluation.id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit Evaluation
            </Button>
          ) : undefined
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <QualityStatusBadge status={evaluation.quality_status} />
        <span className="text-sm text-slate-500">
          Recorded {new Date(evaluation.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Evaluation Summary">
            <dl>
              <p className="text-sm leading-relaxed text-slate-400">
                Quality score of{' '}
                <span className="font-medium text-slate-100">
                  {evaluation.quality_score} / 100
                </span>{' '}
                ({QUALITY_STATUS_LABELS[evaluation.quality_status]}) recorded for{' '}
                <span className="font-medium text-slate-100">
                  {evaluation.vendor.company_name}
                </span>{' '}
                on {formatDate(evaluation.evaluation_date)}.
              </p>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <DetailRow label="Quality status" value={QUALITY_STATUS_LABELS[evaluation.quality_status]} />
                <DetailRow
                  label="Quality score"
                  value={<span className="tabular-nums">{evaluation.quality_score} / 100</span>}
                />
                <DetailRow label="Defect count" value={evaluation.defect_count} />
                <DetailRow label="Total items" value={evaluation.total_items} />
                <DetailRow label="Evaluation date" value={formatDate(evaluation.evaluation_date)} />
                <DetailRow
                  label="Recorded by"
                  value={`${evaluation.evaluator.first_name} ${evaluation.evaluator.last_name}`}
                />
              </div>
            </dl>
          </Section>

          <Section title="Observations">
            <p className="text-sm leading-relaxed text-slate-400">
              {evaluation.comments || 'No observations recorded for this evaluation.'}
            </p>
          </Section>

          <Section title="Vendor">
            <Link
              to={`/vendors/${evaluation.vendor.id}`}
              className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                  {evaluation.vendor.company_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {evaluation.vendor.vendor_code}
                </p>
              </div>
            </Link>
          </Section>

          {reference &&
            (evaluation.purchase_order ? (
              <Section title="Purchase Order">
                <Link
                  to={`/purchase-orders/${evaluation.purchase_order?.id}`}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                    <Package className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                      {evaluation.purchase_order?.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {evaluation.purchase_order?.order_number}
                    </p>
                  </div>
                </Link>
              </Section>
            ) : (
              evaluation.contract && (
                <Section title="Contract">
                  <Link
                    to={`/contracts/${evaluation.contract.id}`}
className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/40 p-4 transition-colors hover:bg-slate-700/40 hover:text-slate-100"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800/60 text-slate-400">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                        {evaluation.contract.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {evaluation.contract.contract_number}
                      </p>
                    </div>
                  </Link>
                </Section>
              )
            ))}
        </div>

        <div className="space-y-8">
          <Section title="System Information">
            <dl>
              <DetailRow label="Created" value={new Date(evaluation.created_at).toLocaleString()} />
              <DetailRow label="Last updated" value={new Date(evaluation.updated_at).toLocaleString()} />
              <DetailRow label="Evaluation ID" value={<span className="font-mono text-xs">{evaluation.id}</span>} />
            </dl>
          </Section>

          <Section title="Assessment">
            <div className="flex items-start gap-2.5">
              <Star className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow
                  label="Score"
                  value={<span className="tabular-nums">{evaluation.quality_score} / 100</span>}
                />
                <DetailRow
                  label="Defects"
                  value={
                    <span className="tabular-nums">
                      {evaluation.defect_count} of {evaluation.total_items || 'n/a'} items
                    </span>
                  }
                />
              </dl>
            </div>
          </Section>

          <Section title="Reference">
            <div className="flex items-start gap-2.5">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <dl>
                <DetailRow
                  label="Reference"
                  value={
                    reference ? (
                      <span className="font-mono text-xs">{reference.label}</span>
                    ) : (
                      'General Evaluation'
                    )
                  }
                />
                <DetailRow
                  label="Evaluator"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-semibold text-indigo-300">
                        {evaluation.evaluator.first_name.charAt(0)}
                        {evaluation.evaluator.last_name.charAt(0)}
                      </span>
                      {evaluation.evaluator.email}
                    </span>
                  }
                />
              </dl>
            </div>
          </Section>
        </div>
      </div>
    </AppLayout>
  )
}