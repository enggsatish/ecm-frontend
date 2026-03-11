import { useState, useMemo } from 'react'
import { Shield, Plus, Trash2, ChevronDown, ChevronRight,
         Lock, Check, X, Loader2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useRoles, usePermissions, useBundles,
  useCreateRole, useDeleteRole,
  useAddPermissionToRole, useRemovePermissionFromRole,
  useApplyBundleToRole,
} from '../../hooks/useAdmin'

// ─── Module display config ────────────────────────────────────────────────────
const MODULE_LABELS = {
  DOCUMENTS: { label: 'Documents',  color: 'blue'   },
  WORKFLOW:  { label: 'Workflow',   color: 'purple' },
  EFORMS:    { label: 'eForms',     color: 'green'  },
  ADMIN:     { label: 'Admin',      color: 'red'    },
  OCR:       { label: 'OCR',        color: 'orange' },
  ARCHIVE:   { label: 'Archive',    color: 'gray'   },
}

const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200',   dot: 'bg-gray-400'   },
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const { data: roles = [],       isLoading: rolesLoading }   = useRoles()
  const { data: permissions = [], isLoading: permsLoading }   = usePermissions()
  const { data: bundles = [],     isLoading: bundlesLoading } = useBundles()

  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const deleteRole = useDeleteRole()

  const isLoading = rolesLoading || permsLoading || bundlesLoading

  // Group permissions by module
  const permsByModule = useMemo(() => {
    const grouped = {}
    permissions.forEach(p => {
      const mod = p.moduleCode ?? p.code?.split(':')[0] ?? 'OTHER'
      if (!grouped[mod]) grouped[mod] = []
      grouped[mod].push(p)
    })
    return grouped
  }, [permissions])

  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null

  const handleDeleteRole = async (role) => {
    if (role.isSystem) return
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
    try {
      await deleteRole.mutateAsync(role.id)
      toast.success('Role deleted')
      if (selectedRoleId === role.id) setSelectedRoleId(null)
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete role')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Roles & Permissions</h2>
            <p className="text-sm text-gray-500">
              {roles.length} roles · {permissions.length} permissions · {bundles.length} bundles
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                     rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6 min-h-[600px]">

        {/* Left: Role list */}
        <div className="col-span-1 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">
            Roles
          </p>
          {roles.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={role.id === selectedRoleId}
              onSelect={() => setSelectedRoleId(role.id)}
              onDelete={() => handleDeleteRole(role)}
            />
          ))}
        </div>

        {/* Right: Permission editor */}
        <div className="col-span-2">
          {selectedRole ? (
            <PermissionEditor
              role={selectedRole}
              permsByModule={permsByModule}
              bundles={bundles}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full
                            border-2 border-dashed border-gray-200 rounded-xl text-center p-8">
              <Shield className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">Select a role to manage its permissions</p>
              <p className="text-xs text-gray-400 mt-1">Click any role on the left to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Create role modal */}
      {showCreateModal && (
        <CreateRoleModal
          bundles={bundles}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newId) => {
            setShowCreateModal(false)
            setSelectedRoleId(newId)
          }}
        />
      )}
    </div>
  )
}

// ─── Role Card ────────────────────────────────────────────────────────────────
function RoleCard({ role, isSelected, onSelect, onDelete }) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center justify-between px-3 py-3 rounded-xl border cursor-pointer
                  transition-all duration-150 group
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {role.isSystem
          ? <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
          : <Shield className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
        }
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
            {role.name}
          </p>
          {role.description && (
            <p className="text-xs text-gray-400 truncate">{role.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {role.isSystem && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                           bg-amber-100 text-amber-700">
            System
          </span>
        )}
        {!role.isSystem && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50
                       text-gray-400 hover:text-red-500 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Permission Editor ────────────────────────────────────────────────────────
function PermissionEditor({ role, permsByModule, bundles }) {
  const [expandedModules, setExpandedModules] = useState(
    Object.keys(permsByModule).reduce((acc, mod) => ({ ...acc, [mod]: true }), {})
  )
  const [applyingBundle, setApplyingBundle] = useState(null)

  const addPerm    = useAddPermissionToRole()
  const removePerm = useRemovePermissionFromRole()
  const applyBundle = useApplyBundleToRole()

  // Build a set of permission CODES this role currently holds.
  // role.permissions may be objects { id, code, ... } or plain code strings —
  // normalise to code in all cases so the check below is consistent.
  const rolePermCodes = useMemo(
    () => new Set((role.permissions ?? []).map(p => p.code ?? p.id ?? p)),
    [role.permissions]
  )

  const togglePermission = async (permCode, currently) => {
    try {
      if (currently) {
        // API: DELETE /api/admin/roles/:id/permissions/:code
        await removePerm.mutateAsync({ roleId: role.id, permissionId: permCode })
      } else {
        // API: POST /api/admin/roles/:id/permissions  { permissionCode }
        await addPerm.mutateAsync({ roleId: role.id, permissionId: permCode })
      }
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Permission update failed')
    }
  }

  const handleApplyBundle = async (bundle) => {
    setApplyingBundle(bundle.id)
    try {
      await applyBundle.mutateAsync({ roleId: role.id, bundleId: bundle.id })
      toast.success(`Bundle "${bundle.name}" applied`)
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Bundle apply failed')
    } finally {
      setApplyingBundle(null)
    }
  }

  const toggleModule = (mod) =>
    setExpandedModules(prev => ({ ...prev, [mod]: !prev[mod] }))

  const isMutating = addPerm.isPending || removePerm.isPending

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{role.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {rolePermCodes.size} of {Object.values(permsByModule).flat().length} permissions granted
            {role.isSystem && <span className="ml-2 text-amber-600">· System role — permissions inherited by all assigned users</span>}
          </p>
        </div>
        {role.isSystem && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50
                           border border-amber-200 rounded-lg px-2.5 py-1">
            <Lock className="w-3 h-3" />
            Read-only
          </span>
        )}
      </div>

      {/* Quick bundles */}
      {!role.isSystem && bundles.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quick Apply Bundle
          </p>
          <div className="flex flex-wrap gap-2">
            {bundles.map(bundle => (
              <button
                key={bundle.id}
                onClick={() => handleApplyBundle(bundle)}
                disabled={applyingBundle === bundle.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                           rounded-lg border border-gray-200 bg-white hover:border-blue-300
                           hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {applyingBundle === bundle.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Package className="w-3 h-3" />
                }
                {bundle.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Permission modules */}
      <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {Object.entries(permsByModule).map(([moduleCode, perms]) => {
          const meta = MODULE_LABELS[moduleCode] ?? { label: moduleCode, color: 'gray' }
          const colors = COLOR_CLASSES[meta.color]
          const isExpanded = expandedModules[moduleCode]
          const grantedCount = perms.filter(p => rolePermCodes.has(p.code)).length

          return (
            <div key={moduleCode}>
              {/* Module header */}
              <button
                onClick={() => toggleModule(moduleCode)}
                className="w-full flex items-center justify-between px-5 py-3
                           hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                  {grantedCount}/{perms.length}
                </span>
              </button>

              {/* Permission rows */}
              {isExpanded && (
                <div className="bg-gray-50/50">
                  {perms.map(perm => {
                    const granted = rolePermCodes.has(perm.code)
                    return (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between px-8 py-2.5
                                   hover:bg-white/80 transition-colors"
                      >
                        <div>
                          <p className="text-sm text-gray-700">{perm.action ?? perm.code?.split(':')[1]}</p>
                          {perm.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{perm.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => !role.isSystem && togglePermission(perm.code, granted)}
                          disabled={isMutating || role.isSystem}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center
                                      transition-all duration-150
                                      ${granted
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-gray-300 bg-white hover:border-blue-400'
                                      }
                                      ${role.isSystem ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {granted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create Role Modal ────────────────────────────────────────────────────────
function CreateRoleModal({ bundles, onClose, onCreated }) {
  const [step, setStep] = useState(1)   // 1=name, 2=bundles, 3=confirm
  const [name, setName] = useState('ECM_')
  const [description, setDescription] = useState('')
  const [selectedBundles, setSelectedBundles] = useState([])

  const createRole    = useCreateRole()
  const applyBundle   = useApplyBundleToRole()

  const nameError = useMemo(() => {
    if (!name) return null
    if (!name.startsWith('ECM_')) return 'Role name must start with ECM_'
    if (name.length < 6) return 'Role name too short'
    if (!/^ECM_[A-Z0-9_]+$/.test(name)) return 'Only uppercase letters, numbers, and underscores'
    return null
  }, [name])

  const handleCreate = async () => {
    try {
      const role = await createRole.mutateAsync({ name, description })
      // Apply selected bundles sequentially
      for (const bundleId of selectedBundles) {
        await applyBundle.mutateAsync({ roleId: role.id, bundleId })
      }
      toast.success(`Role "${name}" created`)
      onCreated(role.id)
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to create role')
    }
  }

  const toggleBundle = (id) =>
    setSelectedBundles(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Create New Role</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-gray-100">
          {['Name', 'Bundles', 'Confirm'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium
                              ${step === i + 1 ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                                  ${step > i + 1 ? 'bg-blue-500 text-white' : step === i + 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                {label}
              </div>
              {i < 2 && <div className="w-4 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-5">

          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="ECM_LOAN_OFFICER"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                              ${nameError ? 'border-red-300' : 'border-gray-300'}`}
                />
                {nameError
                  ? <p className="text-xs text-red-500 mt-1">{nameError}</p>
                  : <p className="text-xs text-gray-400 mt-1">Must start with ECM_, uppercase only</p>
                }
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe what this role does…"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Bundles */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Apply pre-built permission bundles to quickly configure this role.
                You can fine-tune individual permissions after creation.
              </p>
              {bundles.map(bundle => (
                <label key={bundle.id}
                       className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer
                                   transition-all ${selectedBundles.includes(bundle.id)
                                     ? 'border-blue-400 bg-blue-50'
                                     : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={selectedBundles.includes(bundle.id)}
                    onChange={() => toggleBundle(bundle.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{bundle.name}</p>
                    {bundle.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{bundle.description}</p>
                    )}
                  </div>
                </label>
              ))}
              {bundles.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No bundles defined yet</p>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Role name</span>
                  <span className="font-mono font-medium text-gray-900">{name}</span>
                </div>
                {description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Description</span>
                    <span className="text-gray-700 text-right max-w-[200px]">{description}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bundles</span>
                  <span className="text-gray-700">
                    {selectedBundles.length === 0
                      ? 'None (add permissions manually)'
                      : `${selectedBundles.length} bundle(s)`
                    }
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                After creation you can assign this role to users from the Users tab,
                and fine-tune individual permissions on the left panel.
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 pb-6">
          <button
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!!nameError || name.length < 6)}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={createRole.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white
                         rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors
                         disabled:opacity-50"
            >
              {createRole.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Role
            </button>
          )}
        </div>
      </div>
    </div>
  )
}