import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { PageHeader } from '../../components/common/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/common/Modal'
import { EmptyState } from '../../components/common/EmptyState'
import { ErrorState } from '../../components/common/ErrorState'
import { TableSkeleton } from '../../components/common/TableSkeleton'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../components/common/toast-context'
import { vendorCategoriesApi } from '../../services/api'
import { canManageCategories } from '../../utils/permissions'
import { cn } from '../../utils/cn'
import type {
  VendorCategoryPayload,
  VendorCategoryWithCount,
} from '../../types'

const inputClass =
  'mt-1.5 block w-full rounded-md border border-slate-700/80 bg-slate-800/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'

export function VendorCategoriesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const canManage = canManageCategories(user?.role.name ?? '')

  const [categories, setCategories] = useState<VendorCategoryWithCount[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorCategoryWithCount | null>(null)
  const [form, setForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    vendorCategoriesApi
      .list({ include_inactive: includeInactive })
      .then((data) => {
        if (active) {
          setCategories(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load categories')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [includeInactive, reloadKey])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  const load = () => setReloadKey((prev) => prev + 1)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(category: VendorCategoryWithCount) {
    setEditing(category)
    setForm({ name: category.name, description: category.description ?? '' })
    setModalOpen(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) {
      showToast('Category name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: VendorCategoryPayload = {
        name,
        description: form.description.trim() || null,
      }
      if (editing) {
        await vendorCategoriesApi.update(editing.id, payload)
        showToast('Category updated successfully', 'success')
      } else {
        await vendorCategoriesApi.create(payload)
        showToast('Category created successfully', 'success')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save category',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(category: VendorCategoryWithCount) {
    try {
      await vendorCategoriesApi.update(category.id, { is_active: !category.is_active })
      showToast(
        category.is_active ? 'Category deactivated' : 'Category activated',
        'success',
      )
      load()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update category',
        'error',
      )
    }
  }

  return (
    <AppLayout title="Vendor Categories">
      <PageHeader
        title="Vendor Categories"
        subtitle="Organize vendors into categories. Categories can be renamed or deactivated; they cannot be deleted."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
          />
          Include inactive categories
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-[rgb(100,130,180,0.14)] bg-[#162032]">
        {error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : loading ? (
          <TableSkeleton rows={4} columns={4} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            message="Add a category so vendors can be organized."
          />
        ) : (
          <table className="iq-table-body w-full text-left text-sm">
            <thead className="iq-table-head border-b border-slate-800 bg-slate-800/30">
              <tr>
                <th className="iq-th">Name</th>
                <th className="iq-th">Description</th>
                <th className="iq-th">Vendors</th>
                <th className="iq-th">Status</th>
                <th className="iq-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {categories.map((category) => (
                <tr key={category.id} className="iq-row-hover">
                  <td className="iq-td font-medium text-slate-100">
                    {category.name}
                  </td>
                  <td className="iq-td max-w-md text-slate-500">
                    {category.description ?? '—'}
                  </td>
                  <td className="iq-td">
                    <span className="inline-flex rounded-full border border-slate-600/60 bg-slate-800/60 px-2.5 py-0.5 text-xs font-medium tabular-nums text-slate-300">
                      {category.vendor_count}
                    </span>
                  </td>
                  <td className="iq-td">
                    <StatusBadge
                      tone={category.is_active ? 'emerald' : 'slate'}
                      dot
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="iq-td">
                    <div className="flex items-center justify-end gap-3">
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(category)}
                            className="text-xs font-medium text-slate-400 hover:text-slate-200"
                          >
                            {category.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                      {!canManage && <span className="text-xs text-slate-600">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Category' : 'Add Category'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-sm font-medium text-slate-300">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="category-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="IT Equipment"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category-description" className="block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              id="category-description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Any useful context for this category."
              rows={3}
              className={cn(inputClass, 'resize-none')}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}