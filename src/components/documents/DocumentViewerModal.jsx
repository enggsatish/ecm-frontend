/**
 * DocumentViewerModal.jsx
 *
 * Changes in this revision:
 *
 * 1. OCR POLLING — Added refetchInterval to useQuery.
 *    OCR is asynchronous: ecm-ocr picks up the RabbitMQ event AFTER the upload
 *    returns 201. Opening the viewer immediately after upload always shows
 *    ocrCompleted=false and extractedText=null because OCR hasn't finished yet.
 *
 *    Fix: poll getDocument() every 3 seconds while ocrCompleted === false,
 *    stopping automatically once OCR completes or after OCR_POLL_TIMEOUT_MS
 *    (2 minutes). A live "OCR in progress" banner is shown while polling.
 *
 * 2. All other behaviour (preview blob fetch, extracted fields, metadata tab,
 *    object URL cleanup) is unchanged from the Sprint-D version.
 */
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle, FileText, User, Tag, MapPin, Clock, Scan,
         CheckCircle, XCircle, UserCheck, MessageSquare, Play, Flag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDocument, downloadDocument } from '../../api/documentsApi'
import apiClient from '../../api/apiClient'

const getTimeline = (documentId) =>
  apiClient.get(`/api/workflow/timeline/document/${documentId}`).then(r => r.data?.data ?? r.data)

// How often to re-fetch while OCR is pending (ms)
const OCR_POLL_INTERVAL_MS = 3000
// Stop polling after this long even if OCR never completes (ms)
const OCR_POLL_TIMEOUT_MS  = 120_000   // 2 minutes

export default function DocumentViewerModal({ documentId, onClose }) {
  const [tab, setTab] = useState('preview')
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError]   = useState(null)
  const objectUrlRef = useRef(null)

  // ── OCR poll timeout tracking ─────────────────────────────────────────────
  // Track when we first opened this modal so we can stop polling after the
  // timeout even if ocrCompleted never becomes true (e.g. OCR_FAILED status).
  const openedAtRef     = useRef(Date.now())
  const [pollExpired, setPollExpired] = useState(false)

  // ── Document query with conditional polling ───────────────────────────────
  const { data: doc, isLoading } = useQuery({
    queryKey: ['documents', documentId],
    queryFn:  () => getDocument(documentId),
    enabled:  !!documentId,

    // Poll every 3 s while OCR is pending, stop once complete or timed out.
    // refetchInterval receives the latest data on each invocation.
    refetchInterval: (query) => {
      if (pollExpired) return false
      const d = query.state.data
      // Stop polling once OCR completes (ocrCompleted=true) or document failed
      if (d?.ocrCompleted || d?.status === 'OCR_FAILED') return false
      // Stop polling after timeout — prevent indefinite background requests
      if (Date.now() - openedAtRef.current > OCR_POLL_TIMEOUT_MS) {
        setPollExpired(true)
        return false
      }
      return OCR_POLL_INTERVAL_MS
    },
    // Keep showing the previous data while polling (no flicker)
    placeholderData: (prev) => prev,
  })

  const ocrPending = doc && !doc.ocrCompleted && doc.status !== 'OCR_FAILED' && !pollExpired

  // ── Fetch blob for preview ────────────────────────────────────────────────
  useEffect(() => {
    if (!doc || tab !== 'preview') return
    if (!isPreviewable(doc.mimeType)) {
      setPreviewUrl(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    apiClient.get(`/api/documents/${documentId}/download`, { responseType: 'blob' })
      .then(resp => {
        if (cancelled) return
        const url = URL.createObjectURL(resp.data)
        objectUrlRef.current = url
        setPreviewUrl(url)
      })
      .catch(err => {
        if (!cancelled) setPreviewError(err.message ?? 'Preview unavailable')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [doc, documentId, tab])

  // Revoke object URL when modal closes
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  // ── Parse extractedFields ─────────────────────────────────────────────────
  const extractedFields = (() => {
    if (!doc?.extractedFields) return {}
    if (typeof doc.extractedFields === 'object') return doc.extractedFields
    try { return JSON.parse(doc.extractedFields) } catch { return {} }
  })()

  const hasFields = Object.keys(extractedFields).length > 0

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    ['preview',  'Preview'],
    ['fields',   'Extracted Fields'],
    ['text',     'Raw Text'],
    ['metadata', 'Metadata'],
    ['history',  'History'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-gray-400 shrink-0" />
            <h3 className="text-base font-bold text-gray-900 truncate">
              {isLoading ? 'Loading...' : (doc?.name ?? 'Document')}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-4 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* OCR in-progress banner */}
        {ocrPending && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-blue-700 text-sm">
            <Scan size={14} className="shrink-0 animate-pulse" />
            <span>Document is being scanned for text — results will appear automatically.</span>
            <Loader2 size={12} className="ml-auto shrink-0 animate-spin" />
          </div>
        )}

        {/* OCR failed banner */}
        {doc?.status === 'OCR_FAILED' && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-red-50 border-b border-red-100 text-red-700 text-sm">
            <AlertCircle size={14} className="shrink-0" />
            <span>OCR processing failed for this document. Raw text extraction was not completed.</span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 px-4 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === k
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {l}
              {k === 'fields' && hasFields && (
                <span className="ml-1.5 rounded-full bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 font-semibold">
                  {Object.keys(extractedFields).length}
                </span>
              )}
              {k === 'fields' && ocrPending && !hasFields && (
                <Loader2 size={10} className="inline ml-1.5 animate-spin text-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && <Center text="Loading document..." spinner />}

          {/* ── Preview ── */}
          {!isLoading && tab === 'preview' && (
            <>
              {previewLoading && <Center text="Loading preview…" spinner />}
              {previewError   && <Center icon={<AlertCircle size={28} className="text-red-400" />} text={previewError} />}
              {!previewLoading && !previewError && previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full h-[60vh] rounded-lg border border-gray-200"
                  title="Document preview"
                />
              )}
              {!previewLoading && !previewError && !previewUrl && (
                <Center text={`Preview not available for ${doc?.mimeType ?? 'this file type'}`} />
              )}
            </>
          )}

          {/* ── Extracted Fields ── */}
          {!isLoading && tab === 'fields' && (
            <div className="space-y-2">
              {ocrPending && !hasFields && (
                <OcrWaitingPlaceholder message="Scanning document for structured fields…" />
              )}
              {!ocrPending && !hasFields && (
                <p className="text-sm text-gray-400">
                  {doc?.ocrCompleted
                    ? 'No structured fields were extracted. This document may not have a matching field extraction template for its category.'
                    : 'No structured fields extracted yet.'}
                </p>
              )}
              {hasFields && Object.entries(extractedFields).map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-44 flex-shrink-0">
                    {k.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-gray-800">{String(v ?? '—')}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Raw Text ── */}
          {!isLoading && tab === 'text' && (
            <>
              {ocrPending && !doc?.extractedText && (
                <OcrWaitingPlaceholder message="Scanning document — raw text will appear here once complete…" />
              )}
              {(!ocrPending || doc?.extractedText) && (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {doc?.extractedText || (
                    doc?.ocrCompleted
                      ? 'No text was extracted from this document. It may be a scanned image where OCR returned no results, or the Tesseract server was unreachable.'
                      : 'No text extracted yet.'
                  )}
                </pre>
              )}
            </>
          )}

          {/* ── History / Timeline ── */}
          {!isLoading && tab === 'history' && doc && (
            <TimelinePanel documentId={documentId} />
          )}

          {/* ── Metadata ── */}
          {!isLoading && tab === 'metadata' && doc && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <MetaRow icon={<FileText size={13} />} label="Name"          value={doc.name} />
              <MetaRow icon={<FileText size={13} />} label="Original file"  value={doc.originalFilename} />
              <MetaRow icon={<Tag size={13} />}      label="MIME type"     value={doc.mimeType} />
              <MetaRow icon={<Tag size={13} />}      label="Size"          value={doc.fileSizeBytes ? formatBytes(doc.fileSizeBytes) : '—'} />
              <MetaRow icon={<User size={13} />}     label="Uploaded by"   value={doc.uploadedByEmail} />
              <MetaRow icon={<User size={13} />}     label="Party"         value={doc.partyExternalId ?? '—'} />
              <MetaRow icon={<MapPin size={13} />}   label="Segment"       value={doc.segmentName ?? doc.segmentId ?? '—'} />
              <MetaRow icon={<MapPin size={13} />}   label="Product Line"  value={doc.productLineName ?? doc.productLineId ?? '—'} />
              <MetaRow icon={<Tag size={13} />}      label="Category"      value={doc.categoryName ?? doc.categoryId ?? '—'} />
              <MetaRow icon={<Tag size={13} />}      label="Status"        value={doc.status} />
              <MetaRow icon={<Tag size={13} />}      label="Version"       value={doc.version} />
              <MetaRow
                icon={<Scan size={13} />}
                label="OCR"
                value={
                  doc.status === 'OCR_FAILED'  ? 'Failed' :
                  doc.ocrCompleted             ? 'Complete' :
                  ocrPending                   ? 'In progress…' : 'Pending'
                }
              />
              <MetaRow icon={<Clock size={13} />} label="Created" value={doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'} />
              <MetaRow icon={<Clock size={13} />} label="Updated" value={doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : '—'} />
              {doc.tags?.length > 0 && (
                <div className="col-span-2 pt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.tags.map(t => (
                      <span key={t} className="rounded-full bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPreviewable(mimeType) {
  if (!mimeType) return false
  return mimeType.includes('pdf') || mimeType.startsWith('image/')
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function Center({ text, icon, spinner }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
      {spinner && <Loader2 size={24} className="animate-spin" />}
      {icon}
      {text && <p className="text-sm">{text}</p>}
    </div>
  )
}

function MetaRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50">
      <span className="text-gray-300 mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-700 break-all">{value ?? '—'}</span>
    </div>
  )
}

function OcrWaitingPlaceholder({ message }) {
  return (
    <div className="flex items-center gap-3 py-6 text-blue-500">
      <Loader2 size={18} className="animate-spin shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Timeline Panel ────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  FORM_SUBMITTED:     { icon: FileText,       color: 'text-blue-500',   bg: 'bg-blue-50' },
  WORKFLOW_STARTED:   { icon: Play,           color: 'text-indigo-500', bg: 'bg-indigo-50' },
  TASK_CLAIMED:       { icon: UserCheck,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  TASK_APPROVED:      { icon: CheckCircle,    color: 'text-green-600',  bg: 'bg-green-50' },
  TASK_REJECTED:      { icon: XCircle,        color: 'text-red-500',    bg: 'bg-red-50' },
  TASK_INFO_REQUESTED:{ icon: MessageSquare,  color: 'text-amber-600',  bg: 'bg-amber-50' },
  TASK_RELEASED:      { icon: User,           color: 'text-gray-500',   bg: 'bg-gray-50' },
  WORKFLOW_COMPLETED: { icon: Flag,           color: 'text-green-600',  bg: 'bg-green-50' },
  DOCUMENT_CREATED:   { icon: FileText,       color: 'text-purple-500', bg: 'bg-purple-50' },
  OCR_COMPLETED:      { icon: Scan,           color: 'text-teal-600',   bg: 'bg-teal-50' },
  FORM_APPROVED:      { icon: CheckCircle,    color: 'text-green-600',  bg: 'bg-green-50' },
  FORM_REJECTED:      { icon: XCircle,        color: 'text-red-500',    bg: 'bg-red-50' },
  CASE_NOTE:          { icon: MessageSquare,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
}

const DEFAULT_EVENT = { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50' }

function TimelinePanel({ documentId }) {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ['timeline', 'document', documentId],
    queryFn:  () => getTimeline(documentId),
    enabled:  !!documentId,
    staleTime: 30_000,
  })

  if (isLoading) return <Center text="Loading timeline..." spinner />

  const events = Array.isArray(timeline) ? timeline : []

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={28} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No history available for this document</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" />

      <div className="space-y-0">
        {events.map((evt, i) => {
          const cfg = EVENT_CONFIG[evt.eventType] ?? DEFAULT_EVENT
          const Icon = cfg.icon
          const ts = evt.timestamp
            ? new Date(evt.timestamp).toLocaleString('en-CA', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })
            : '—'

          return (
            <div key={i} className="flex items-start gap-3 py-2.5 relative">
              {/* Icon dot */}
              <div className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 z-10 border-2 border-white`}>
                <Icon size={14} className={cfg.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">{evt.description}</p>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{ts}</span>
                </div>
                {evt.actor && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    by {evt.actor}
                  </p>
                )}
                {evt.comment && (
                  <div className="mt-1 px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-600 italic">"{evt.comment}"</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
