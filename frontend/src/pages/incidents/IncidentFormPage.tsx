import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorState } from '../../components/common/ErrorState'
import { IncidentForm } from '../../components/incidents/IncidentForm'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { incidentsApi, usersApi, vendorsApi } from '../../services/api'
import { canManageIncidents } from '../../utils/permissions'
import type {
  IncidentDetail,
  IncidentPayload,
  IncidentUpdatePayload,
  UserListItem,
  VendorListItem,
} from '../../types'

export function IncidentFormPage() {
  const { incidentId } = useParams()
  const isEdit = incidentId != null
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const roleName = user?.role.name ?? ''
  const allowed = canManageIncidents(roleName)

  const [vendors, setVendors] = useState<VendorListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [initialValues, setInitialValues] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let active = true
    Promise.all([
      vendorsApi.list({ page_size: 100 }),
      usersApi.list(),
      isEdit
        ? incidentsApi.get(Number(incidentId)).catch(() => null)
        : Promise.resolve<IncidentDetail | null>(null),
    ])
      .then(([vendorData, userData, incident]) => {
        if (!active) return
        setVendors(vendorData.items)
        setUsers(userData)
        if (isEdit && incident === null) {
          setError('Incident not found')
        } else {
          setError(null)
          setInitialValues(incident)
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
  }, [allowed, isEdit, incidentId])

  const handleSubmit = useCallback(
    async (payload: IncidentPayload | IncidentUpdatePayload) => {
      setSubmitting(true)
      const errorDefault = isEdit
        ? 'Failed to update incident'
        : 'Failed to create incident'
      try {
        const incident = isEdit
          ? await incidentsApi.update(Number(incidentId), payload as IncidentUpdatePayload)
          : await incidentsApi.create(payload as IncidentPayload)
        showToast(
          isEdit
            ? 'Incident updated successfully'
            : 'Incident reported successfully',
          'success',
        )
        navigate(`/incidents/${incident.id}`)
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : errorDefault
        showToast(message, 'error')
      } finally {
        setSubmitting(false)
      }
    },
    [isEdit, incidentId, navigate, showToast],
  )

  if (!allowed) {
    return (
      <AppLayout title="Incidents">
        <PageHeader
          title={isEdit ? 'Edit Incident' : 'Report Incident'}
          subtitle="Record a vendor-related issue for tracking and resolution."
        />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Access restricted</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your role does not allow creating or editing incidents.
          </p>
        </div>
      </AppLayout>
    )
  }

  if (isEdit && initialValues?.status === 'CLOSED') {
    return (
      <AppLayout title="Incidents">
        <PageHeader title="Edit Incident" />
        <div className="iq-card p-12 text-center">
          <h3 className="text-sm font-medium text-slate-100">Incident is closed</h3>
          <p className="mt-1 text-sm text-slate-500">
            Closed incidents cannot be modified. View the incident for reference.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate(`/incidents/${incidentId}`)}>
              View Incident
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Incidents">
      <PageHeader
        title={isEdit ? 'Edit Incident' : 'Report Incident'}
        subtitle="Record a vendor-related issue for tracking and resolution."
      />
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => navigate('/incidents')}
        />
      ) : loading ? (
        <div className="iq-card flex items-center justify-center gap-2 px-6 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {vendors.length === 0 ? (
            <div className="iq-card p-12 text-center">
              <h3 className="text-sm font-medium text-slate-100">No vendors are available</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create a vendor before reporting an incident.
              </p>
              <div className="mt-4">
                <Button onClick={() => navigate('/vendors/new')}>
                  Add Vendor
                </Button>
              </div>
            </div>
          ) : (
            <IncidentForm
              key={initialValues?.id ?? 'new'}
              initialValues={initialValues}
              isEdit={isEdit}
              vendors={vendors}
              users={users}
              submitLabel={isEdit ? 'Save Changes' : 'Submit Incident'}
              isSubmitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </AppLayout>
  )
}