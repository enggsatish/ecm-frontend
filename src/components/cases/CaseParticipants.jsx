/**
 * CaseParticipants — Participants tab for Case Detail page.
 * Add/remove external participants, share documents, copy access link.
 */
import { useState } from 'react'
import {
  UserPlus, X, Loader2, ExternalLink, Copy, Share2, Mail, Phone, Building2, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useParticipants, useAddParticipant, useRemoveParticipant, useShareDocuments,
} from '../../hooks/useAdmin'

const ROLES = ['LAWYER', 'APPRAISER', 'NOTARY', 'TITLE_COMPANY', 'OTHER']

const ROLE_COLORS = {
  LAWYER:        'bg-purple-50 text-purple-700',
  APPRAISER:     'bg-blue-50 text-blue-700',
  NOTARY:        'bg-amber-50 text-amber-700',
  TITLE_COMPANY: 'bg-green-50 text-green-700',
  OTHER:         'bg-gray-100 text-gray-600',
}

export default function CaseParticipants({ caseId, checklist, isCaseClosed }) {
  const { data: participants = [], isLoading } = useParticipants(caseId)
  const addMut = useAddParticipant()
  const removeMut = useRemoveParticipant()
  const shareMut = useShareDocuments()

  const [showAdd, setShowAdd] = useState(false)
  const [showShare, setShowShare] = useState(null) // participantId
  const [form, setForm] = useState({ name: '', email: '', organization: '', role: 'LAWYER', phone: '' })
  const [selectedDocs, setSelectedDocs] = useState([])

  const participantList = Array.isArray(participants) ? participants : []

  const handleAdd = () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return }
    addMut.mutate({ caseId, payload: form }, {
      onSuccess: () => {
        toast.success('Participant added')
        setShowAdd(false)
        setForm({ name: '', email: '', organization: '', role: 'LAWYER', phone: '' })
      },
      onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add'),
    })
  }

  const handleRemove = (participantId) => {
    if (!confirm('Remove this participant? Their access link will be revoked.')) return
    removeMut.mutate({ caseId, participantId }, {
      onSuccess: () => toast.success('Participant removed'),
    })
  }

  const handleShare = (participantId) => {
    if (selectedDocs.length === 0) { toast.error('Select at least one document'); return }
    shareMut.mutate({ caseId, payload: { participantId, caseDocumentIds: selectedDocs } }, {
      onSuccess: () => {
        toast.success('Documents shared')
        setShowShare(null)
        setSelectedDocs([])
      },
      onError: (e) => toast.error(e?.response?.data?.message || 'Failed to share'),
    })
  }

  const copyInviteLink = (token) => {
    const link = `${window.location.origin}/external/case/${token}`
    navigator.clipboard.writeText(link)
    toast.success('Invite link copied to clipboard')
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-gray-400">
      <Loader2 size={16} className="animate-spin mr-2" /> Loading participants...
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-700">
          {participantList.filter(p => p.isActive).length} participant(s)
          {isCaseClosed && <span className="text-xs text-gray-400 ml-2">(case closed — access revoked)</span>}
        </p>
        {!isCaseClosed && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <UserPlus size={12} /> Add Participant
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email address *" type="email"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
              placeholder="Organization" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (optional)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={addMut.isPending}
              className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {addMut.isPending ? 'Adding...' : 'Add Participant'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Participant list */}
      {participantList.filter(p => p.isActive).length === 0 && !showAdd ? (
        <div className="text-center py-8">
          <UserPlus size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No external participants</p>
          <p className="text-xs text-gray-400 mt-1">Add lawyers, appraisers, or other external parties</p>
        </div>
      ) : (
        <div className="space-y-3">
          {participantList.filter(p => p.isActive).map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] ?? ROLE_COLORS.OTHER}`}>
                      {p.role?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Mail size={10} /> {p.email}</span>
                    {p.phone && <span className="flex items-center gap-1"><Phone size={10} /> {p.phone}</span>}
                    {p.organization && <span className="flex items-center gap-1"><Building2 size={10} /> {p.organization}</span>}
                  </div>
                  {p.lastAccessedAt && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Last accessed: {new Date(p.lastAccessedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isCaseClosed && (
                    <>
                      <button onClick={() => copyInviteLink(p.inviteToken)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                        title="Copy access link">
                        <Copy size={11} /> Link
                      </button>
                      <button onClick={() => { setShowShare(p.id); setSelectedDocs([]) }}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        title="Share documents">
                        <Share2 size={11} /> Share
                      </button>
                    </>
                  )}
                  {!isCaseClosed && (
                    <button onClick={() => handleRemove(p.id)}
                      className="p-1 text-gray-400 hover:text-red-500" title="Remove">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Share documents picker */}
              {showShare === p.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">Select documents to share:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 mb-2">
                    {(checklist ?? []).filter(i => i.documentId).map(item => (
                      <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedDocs.includes(item.id)}
                          onChange={() => setSelectedDocs(prev =>
                            prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          )} className="rounded" />
                        <span className="text-sm text-gray-700 flex-1">{item.documentTypeName}</span>
                        {item.documentName && <span className="text-xs text-gray-400 truncate max-w-[150px]">{item.documentName}</span>}
                      </label>
                    ))}
                    {(checklist ?? []).filter(i => i.documentId).length === 0 && (
                      <p className="text-xs text-gray-400 py-2 text-center">No documents uploaded yet</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleShare(p.id)} disabled={shareMut.isPending || selectedDocs.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      <Check size={11} /> Share {selectedDocs.length} doc(s)
                    </button>
                    <button onClick={() => setShowShare(null)} className="text-xs text-gray-500 px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inactive participants */}
      {participantList.filter(p => !p.isActive).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Removed participants:</p>
          {participantList.filter(p => !p.isActive).map(p => (
            <div key={p.id} className="text-xs text-gray-400 py-1">
              {p.name} ({p.email}) — {p.role}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
