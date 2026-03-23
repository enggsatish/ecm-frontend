/**
 * ExternalCasePage.jsx
 * Route: /external/case/:inviteToken
 *
 * Lightweight external portal for lawyers, appraisers, etc.
 * No Okta login — OTP-based access via email.
 *
 * Flow: Enter email → receive OTP → enter OTP → view shared docs + upload
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Shield, Mail, KeyRound, FileText, Upload, Download, Loader2,
  CheckCircle, Clock, FolderOpen, User, Building2, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  requestExternalOtp, verifyExternalOtp, externalUpload, externalComment,
} from '../../api/adminApi'

const STATUS_COLORS = {
  OPEN:               'bg-blue-50 text-blue-700',
  DOCUMENTS_PENDING:  'bg-amber-50 text-amber-700',
  UNDER_REVIEW:       'bg-indigo-50 text-indigo-700',
  APPROVED:           'bg-green-50 text-green-700',
  COMPLETED:          'bg-green-50 text-green-700',
  REJECTED:           'bg-red-50 text-red-700',
}

// ── External Uploads Component ────────────────────────────────────────────────
function ExternalUploads({ sessionToken, uploads, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!sessionToken) {
      toast.error('Session expired. Please log in again.')
      return
    }
    setUploading(true)
    try {
      const result = await externalUpload(sessionToken, file, description || null)
      toast.success('Document uploaded successfully')
      if (result && onUploaded) onUploaded(result)
      setDescription('')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed'
      toast.error(msg)
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Upload size={14} className="text-green-500" /> Your Uploads
        </h2>
      </div>

      {/* Upload area */}
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex gap-2">
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <label className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors
            ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload File'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.xlsx,.xls" />
          </label>
        </div>
      </div>

      {uploads.length === 0 ? (
        <div className="py-6 text-center">
          <Upload size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {uploads.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <FileText size={14} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{u.originalFilename}</p>
                {u.description && <p className="text-xs text-gray-400">{u.description}</p>}
              </div>
              <span className="text-xs text-gray-400">
                {u.uploadedAt ? new Date(u.uploadedAt).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── External Comments Component ──────────────────────────────────────────────
function ExternalComments({ sessionToken }) {
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!comment.trim()) return
    setSending(true)
    try {
      await externalComment(sessionToken, comment.trim())
      toast.success('Comment added')
      setComment('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add comment')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare size={14} className="text-blue-500" /> Comments
        </h2>
      </div>
      <div className="px-5 py-4">
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          rows={3} placeholder="Add a comment or question about this case..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2" />
        <div className="flex items-center justify-between">
          {sent && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Comment sent</p>}
          {!sent && <div />}
          <button onClick={handleSubmit} disabled={!comment.trim() || sending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600
                       rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            Send Comment
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ExternalCasePage() {
  const { inviteToken } = useParams()
  const [step, setStep] = useState('email') // email | otp | view
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [caseView, setCaseView] = useState(null)
  const [sessionToken, setSessionToken] = useState(null)
  const [error, setError] = useState('')

  const handleRequestOtp = async () => {
    if (!inviteToken) {
      setError('Invalid access link — no invite token found')
      toast.error('Invalid access link')
      return
    }
    setLoading(true)
    setError('')
    try {
      await requestExternalOtp(inviteToken)
      toast.success('Verification code sent to your email')
      setStep('otp')
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to send verification code'
      setError(msg)
      toast.error(msg)
      console.error('OTP request failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await verifyExternalOtp(inviteToken, { email, otp })
      setSessionToken(data.sessionToken)
      setCaseView(data.caseView)
      setStep('view')
    } catch (e) {
      const msg = e?.response?.data?.message || 'Invalid or expired code'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Email step ──────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Shield size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Secure Access</h1>
              <p className="text-xs text-gray-400">ECM Document Portal</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Enter your email address to receive a verification code.
          </p>

          <div className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                placeholder="your@email.com"
                onKeyDown={e => { if (e.key === 'Enter' && email) handleRequestOtp() }}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleRequestOtp} disabled={!email || loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Send Verification Code
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── OTP step ────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <KeyRound size={20} className="text-green-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Enter Verification Code</h1>
              <p className="text-xs text-gray-400">Sent to {email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" maxLength={6}
              onKeyDown={e => { if (e.key === 'Enter' && otp.length === 6) handleVerifyOtp() }}
              className="w-full text-center text-2xl tracking-[0.5em] font-mono border border-gray-300
                         rounded-lg py-3 focus:outline-none focus:ring-2 focus:ring-green-500" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleVerifyOtp} disabled={otp.length !== 6 || loading}
              className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg
                         hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Verify & Access
            </button>
            <button onClick={() => { setStep('email'); setOtp(''); setError('') }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Case view ───────────────────────────────────────────────────────────
  const cv = caseView
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderOpen size={18} className="text-blue-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">{cv?.productName}</h1>
              <p className="text-xs text-gray-400">{cv?.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[cv?.caseStatus] ?? 'bg-gray-100 text-gray-500'}`}>
              {cv?.caseStatus?.replace(/_/g, ' ')}
            </span>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-700">{cv?.participantName}</p>
              <p className="text-[10px] text-gray-400">{cv?.participantRole}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Shared documents */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FileText size={14} className="text-blue-500" /> Shared Documents
            </h2>
          </div>
          {(cv?.sharedDocuments ?? []).length === 0 ? (
            <div className="py-8 text-center">
              <FileText size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No documents have been shared with you yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cv.sharedDocuments.map(doc => (
                <div key={doc.caseDocumentId} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{doc.documentTypeName}</p>
                    {doc.documentName && <p className="text-xs text-gray-400 truncate">{doc.documentName}</p>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    doc.status === 'APPROVED' ? 'bg-green-50 text-green-600' :
                    doc.status === 'UPLOADED' ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>{doc.status}</span>
                  {doc.documentId && (
                    <a href={`/api/documents/${doc.documentId}/download`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                      <Download size={11} /> Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Uploads from this participant */}
        <ExternalUploads sessionToken={sessionToken} uploads={cv?.uploads ?? []}
          onUploaded={(u) => setCaseView(prev => prev ? { ...prev, uploads: [u, ...(prev.uploads ?? [])] } : prev)} />

        {/* Comments */}
        <ExternalComments sessionToken={sessionToken} />
      </div>
    </div>
  )
}
