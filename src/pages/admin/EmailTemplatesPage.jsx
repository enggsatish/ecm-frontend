/**
 * EmailTemplatesPage.jsx
 * Route: /admin/email-templates
 *
 * Admin UI for managing email templates used by the notification service.
 * Templates use {{variable}} placeholders substituted at send time.
 */
import { useState } from 'react'
import { Loader2, Save, Mail, Eye, ArrowLeft, Code, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEmailTemplates, useUpdateEmailTemplate } from '../../hooks/useAdmin'

const VARIABLE_HELP = {
  OTP_VERIFICATION:   ['otp'],
  PARTICIPANT_INVITE: ['name', 'role', 'inviteLink', 'appUrl'],
  USER_INVITE:        ['displayName', 'role', 'signInLink', 'appUrl'],
  TASK_ASSIGNED:      ['taskName', 'candidateGroup', 'documentName', 'appUrl'],
  CASE_STATUS_CHANGED:['caseRef', 'customerName', 'status', 'reason', 'caseId', 'appUrl'],
}

export default function EmailTemplatesPage() {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const updateMut = useUpdateEmailTemplate()
  const [editing, setEditing] = useState(null)       // template id being edited
  const [form, setForm] = useState({})
  const [previewMode, setPreviewMode] = useState(false)

  const startEdit = (t) => {
    setEditing(t.id)
    setForm({
      name: t.name,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      isActive: t.isActive,
    })
    setPreviewMode(false)
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm({})
  }

  const handleSave = () => {
    updateMut.mutate({ id: editing, ...form }, {
      onSuccess: () => { toast.success('Template saved'); setEditing(null) },
      onError: () => toast.error('Failed to save template'),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading templates...
      </div>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  if (editing) {
    const tpl = templates.find(t => t.id === editing)
    const variables = VARIABLE_HELP[tpl?.templateKey] || []

    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded hover:bg-gray-100">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{form.name}</h3>
              <p className="text-[11px] text-gray-400 font-mono">{tpl?.templateKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              {previewMode ? <Code size={13} /> : <Eye size={13} />}
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            <button onClick={handleSave} disabled={updateMut.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {updateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>

        <div className="flex gap-5">
          {/* Editor / Preview */}
          <div className="flex-1 space-y-4">
            {/* Active toggle */}
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Active</span>
              <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Template name */}
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <label className="text-xs font-medium text-gray-500 block mb-1">Template Name</label>
              <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-400" />
            </div>

            {/* Subject */}
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <label className="text-xs font-medium text-gray-500 block mb-1">Subject Line</label>
              {previewMode ? (
                <p className="text-sm text-gray-800 py-1">{substitutePreview(form.subjectTemplate, variables)}</p>
              ) : (
                <input value={form.subjectTemplate || ''} onChange={e => setForm(f => ({ ...f, subjectTemplate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 font-mono focus:outline-none focus:border-blue-400" />
              )}
            </div>

            {/* Body */}
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <label className="text-xs font-medium text-gray-500 block mb-1">Email Body (HTML)</label>
              {previewMode ? (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: substitutePreview(form.bodyTemplate, variables) }} />
              ) : (
                <textarea value={form.bodyTemplate || ''} onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))}
                  rows={16}
                  className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 font-mono focus:outline-none focus:border-blue-400 resize-y" />
              )}
            </div>
          </div>

          {/* Variable reference sidebar */}
          <div className="w-56 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Available Variables</p>
              {variables.length > 0 ? (
                <div className="space-y-1.5">
                  {variables.map(v => (
                    <div key={v} className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {'{{' + v + '}}'}
                      </code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No variables defined</p>
              )}
              <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                Use <code className="bg-gray-100 px-1 rounded">{'{{variableName}}'}</code> in subject or body.
                Unmatched placeholders are left as-is in the email.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {templates.map(t => (
          <div key={t.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
            <div className="p-2 rounded-lg bg-blue-50">
              <Mail size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                {!t.isActive && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">inactive</span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{t.templateKey}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subjectTemplate}</p>
            </div>
            <button onClick={() => startEdit(t)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer">
              Edit
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            No email templates found. Run the database seed to create default templates.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Preview helper — replaces {{var}} with sample values ────────────────────
function substitutePreview(template, variables) {
  if (!template) return ''
  let result = template
  const sampleValues = {
    otp: '847291',
    name: 'John Smith',
    role: 'Document Reviewer',
    inviteLink: '#',
    signInLink: '#',
    appUrl: '#',
    displayName: 'Jane Doe',
    taskName: 'Backoffice Review',
    candidateGroup: 'Back Office',
    documentName: 'KYC_Document.pdf',
    caseRef: 'LOAN-2026-00101',
    customerName: 'Acme Corp',
    status: 'Under Review',
    reason: 'Additional documents required',
    caseId: '00000000-0000-0000-0000-000000000000',
  }
  for (const v of variables) {
    result = result.replaceAll('{{' + v + '}}', sampleValues[v] || v)
  }
  return result
}
