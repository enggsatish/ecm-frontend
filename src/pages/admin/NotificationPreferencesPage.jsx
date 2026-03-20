/**
 * NotificationPreferencesPage.jsx
 * Route: /admin/notifications
 *
 * Two sections:
 *   1. My Notification Preferences — per-category toggles for IN_APP and EMAIL channels
 *   2. Email Templates (admin only) — view and edit HTML email templates
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Mail, Eye, Edit2, Check, X, Loader2, Code } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getNotificationPreferences, setNotificationPreference,
  getEmailTemplates, updateEmailTemplate,
} from '../../api/adminApi'
import useUserStore from '../../store/userStore'

const CATEGORIES = [
  { key: 'TASK_ASSIGNED',   label: 'Task Assigned',     desc: 'When a review task is assigned to your role' },
  { key: 'FORM_APPROVED',   label: 'Form Approved',     desc: 'When your form submission is approved' },
  { key: 'FORM_REJECTED',   label: 'Form Rejected',     desc: 'When your form submission is rejected' },
  { key: 'WORKFLOW_UPDATE', label: 'Workflow Update',   desc: 'When your submission progresses through a workflow step' },
]

const CHANNELS = [
  { key: 'IN_APP', label: 'In-App', icon: Bell },
  { key: 'EMAIL',  label: 'Email',  icon: Mail },
]

// ── Preferences Section ──────────────────────────────────────────────────────
function PreferencesSection() {
  const qc = useQueryClient()
  const { data: prefs = [], isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  })

  const mutation = useMutation({
    mutationFn: setNotificationPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences'] }),
  })

  const isEnabled = (category, channel) => {
    const list = Array.isArray(prefs) ? prefs : []
    const pref = list.find(p => p.category === category && p.channel === channel)
    return pref ? pref.enabled : true
  }

  const toggle = (category, channel) => {
    mutation.mutate({ category, channel, enabled: !isEnabled(category, channel) })
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-3">My Notification Preferences</h3>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Notification</th>
              {CHANNELS.map(ch => (
                <th key={ch.key} className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 w-24">
                  <span className="flex items-center justify-center gap-1">
                    <ch.icon size={12} /> {ch.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CATEGORIES.map(cat => (
              <tr key={cat.key}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 text-sm">{cat.label}</p>
                  <p className="text-xs text-gray-400">{cat.desc}</p>
                </td>
                {CHANNELS.map(ch => (
                  <td key={ch.key} className="px-4 py-3 text-center">
                    <button onClick={() => toggle(cat.key, ch.key)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        isEnabled(cat.key, ch.key) ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        isEnabled(cat.key, ch.key) ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Email Templates Section ──────────────────────────────────────────────────
function EmailTemplatesSection() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [previewMode, setPreviewMode] = useState(false)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: getEmailTemplates,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateEmailTemplate(id, payload),
    onSuccess: () => {
      toast.success('Template updated')
      qc.invalidateQueries({ queryKey: ['email-templates'] })
      setEditing(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Update failed'),
  })

  const startEdit = (t) => {
    setForm({
      name: t.name,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      isActive: t.isActive,
    })
    setEditing(t)
    setPreviewMode(false)
  }

  const templateList = Array.isArray(templates) ? templates : []

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Email Templates</h3>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-2">
          {templateList.map(t => (
            <div key={t.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.templateKey}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Subject: {t.subjectTemplate}</p>
              </div>
              <button onClick={() => startEdit(t)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                <Edit2 size={11} /> Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Edit Email Template</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{editing.templateKey}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Subject Template
                  <span className="text-gray-400 font-normal ml-1">{'(use {{variable}} for dynamic values)'}</span>
                </label>
                <input value={form.subjectTemplate} onChange={e => setForm(f => ({ ...f, subjectTemplate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">Body Template (HTML)</label>
                  <button onClick={() => setPreviewMode(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    {previewMode ? <><Code size={11} /> Code</> : <><Eye size={11} /> Preview</>}
                  </button>
                </div>
                {previewMode ? (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-[200px] max-h-[400px] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: form.bodyTemplate }} />
                ) : (
                  <textarea value={form.bodyTemplate}
                    onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))}
                    rows={12}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y bg-gray-950 text-green-300" />
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {['taskName', 'documentName', 'decision', 'comment', 'count', 'items', 'appUrl'].map(v => (
                    <span key={v} className="text-[10px] font-mono bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      {'{{' + v + '}}'}
                    </span>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="rounded" />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => updateMut.mutate({ id: editing.id, payload: form })}
                disabled={updateMut.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Check size={14} /> {updateMut.isPending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationPreferencesPage() {
  const { user } = useUserStore()
  const isAdmin = user?.roles?.includes('ECM_ADMIN')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage how you receive notifications</p>
      </div>

      <PreferencesSection />

      {isAdmin && <EmailTemplatesSection />}
    </div>
  )
}
