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
         CheckCircle, XCircle, UserCheck, MessageSquare, Play, Flag,
         Maximize2, Minimize2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDocument, downloadDocument } from '../../api/documentsApi'
import { getDocumentWorkflows } from '../../api/workflowApi'
import apiClient from '../../api/apiClient'

const getTimeline = (documentId) =>
  apiClient.get(`/api/workflow/timeline/document/${documentId}`).then(r => r.data?.data ?? r.data)

// How often to re-fetch while OCR is pending (ms)
const OCR_POLL_INTERVAL_MS = 3000
// Stop polling after this long even if OCR never completes (ms)
const OCR_POLL_TIMEOUT_MS  = 120_000   // 2 minutes

export default function DocumentViewerModal({ documentId, onClose, previewOnly = false }) {
  const [tab, setTab] = useState('preview')
  const [maximized, setMaximized] = useState(false)
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

  // ── Workflow review status for this document ──────────────────────────────
  const { data: workflowsRaw } = useQuery({
    queryKey: ['workflow', 'document', documentId],
    queryFn: () => getDocumentWorkflows(documentId),
    enabled: !!documentId,
    staleTime: 15_000,
    refetchInterval: 30_000,
    throwOnError: false,
  })

  // Defensive: handle various response shapes (list, object with content, etc.)
  const workflows = Array.isArray(workflowsRaw) ? workflowsRaw
    : Array.isArray(workflowsRaw?.content) ? workflowsRaw.content
    : []

  const activeWorkflow = workflows.length > 0
    ? workflows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
    : null

  const REVIEW_STATUS_LABELS = {
    ACTIVE:              { label: 'Under Review',   color: 'text-blue-700 bg-blue-50' },
    INFO_REQUESTED:      { label: 'Info Requested', color: 'text-amber-700 bg-amber-50' },
    COMPLETED_APPROVED:  { label: 'Approved',       color: 'text-green-700 bg-green-50' },
    COMPLETED_REJECTED:  { label: 'Rejected',       color: 'text-red-700 bg-red-50' },
    CANCELLED:           { label: 'Cancelled',      color: 'text-gray-500 bg-gray-100' },
  }

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
    ['history',  'Pipeline'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`bg-white shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
        maximized
          ? 'fixed inset-2 rounded-xl'
          : 'rounded-2xl w-full max-w-4xl mx-4 h-[90vh]'
      }`}>

        {/* Header — fixed */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-gray-400 shrink-0" />
            <h3 className="text-base font-bold text-gray-900 truncate">
              {isLoading ? 'Loading...' : (doc?.name ?? 'Document')}
            </h3>
          </div>
          <div className="flex items-center gap-1 ml-4 shrink-0">
            <button onClick={() => setMaximized(v => !v)}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
              title={maximized ? 'Restore' : 'Maximize'}>
              {maximized
                ? <Minimize2 size={16} />
                : <Maximize2 size={16} />
              }
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
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

        {/* Tab bar — fixed, hidden in preview-only mode */}
        {!previewOnly && <div className="flex border-b border-gray-200 px-4 overflow-x-auto flex-shrink-0">
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
        </div>}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {isLoading && <Center text="Loading document..." spinner />}

          {/* ── Preview ── */}
          {!isLoading && tab === 'preview' && (
            <>
              {previewLoading && <Center text="Loading preview…" spinner />}
              {previewError   && <Center icon={<AlertCircle size={28} className="text-red-400" />} text={previewError} />}
              {!previewLoading && !previewError && previewUrl && (
                <iframe
                  src={previewUrl}
                  className={`w-full rounded-lg border border-gray-200 ${maximized ? 'flex-1 min-h-0' : 'h-[60vh]'}`}
                  style={maximized ? { height: 'calc(100vh - 200px)' } : undefined}
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

          {/* ── History / Pipeline Graph ── */}
          {!isLoading && tab === 'history' && doc && (
            <TimelinePanel documentId={documentId} doc={doc} activeWorkflow={activeWorkflow} />
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
              <MetaRow
                icon={<Play size={13} />}
                label="Review"
                value={
                  activeWorkflow
                    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_LABELS[activeWorkflow.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {REVIEW_STATUS_LABELS[activeWorkflow.status]?.label || activeWorkflow.status}
                      </span>
                    : <span className="text-gray-400">No workflow</span>
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

// ── Document Flow Graph (branching pipeline view) ─────────────────────────────
//
// Visualizes the document's processing pipeline as a branching graph:
//   ● Uploaded → ┬─ OCR branch ──── ● Pending → ● Completed
//               └─ Review branch ── ● Queued → ● Claimed → ● Approved/Rejected
//
// Documents without a workflow show a single OCR line.

const OCR_EVENTS    = new Set(['OCR_COMPLETED'])
const WF_EVENTS     = new Set(['WORKFLOW_STARTED','TASK_CLAIMED','TASK_APPROVED','TASK_REJECTED',
                               'TASK_INFO_REQUESTED','TASK_RELEASED','WORKFLOW_COMPLETED',
                               'FORM_APPROVED','FORM_REJECTED'])

function fmtTs(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// A single node in the graph
function Node({ label, sub, ts, color, pulse, icon: Icon }) {
  const colorMap = {
    gray:   'bg-gray-200 border-gray-300 text-gray-500',
    blue:   'bg-blue-100 border-blue-400 text-blue-600',
    teal:   'bg-teal-100 border-teal-400 text-teal-600',
    green:  'bg-green-100 border-green-400 text-green-600',
    red:    'bg-red-100 border-red-400 text-red-600',
    amber:  'bg-amber-100 border-amber-400 text-amber-600',
    indigo: 'bg-indigo-100 border-indigo-400 text-indigo-600',
    purple: 'bg-purple-100 border-purple-400 text-purple-600',
  }
  const cls = colorMap[color] || colorMap.gray

  return (
    <div className="flex flex-col items-center min-w-[72px]">
      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${cls}
                       ${pulse ? 'animate-pulse ring-2 ring-offset-1 ring-blue-300' : ''}`}>
        {Icon && <Icon size={12} />}
      </div>
      <span className="text-[10px] font-semibold text-gray-700 mt-1 text-center leading-tight">{label}</span>
      {sub && <span className="text-[9px] text-gray-400 text-center leading-tight">{sub}</span>}
      {ts && <span className="text-[9px] text-gray-400 mt-0.5">{ts}</span>}
    </div>
  )
}

// Horizontal connector line
function Connector({ color = 'gray' }) {
  const borderColor = {
    gray: 'border-gray-300', blue: 'border-blue-300', teal: 'border-teal-300',
    green: 'border-green-300', red: 'border-red-300', indigo: 'border-indigo-300',
  }
  return <div className={`w-8 border-t-2 border-dashed ${borderColor[color] || borderColor.gray} self-center mt-[-14px]`} />
}

function TimelinePanel({ documentId, doc, activeWorkflow }) {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ['timeline', 'document', documentId],
    queryFn:  () => getTimeline(documentId),
    enabled:  !!documentId,
    staleTime: 30_000,
  })

  if (isLoading) return <Center text="Loading..." spinner />

  const events = Array.isArray(timeline) ? timeline : []

  // Find key events by type
  const findEvt = (type) => events.find(e => e.eventType === type)
  const docCreated     = findEvt('DOCUMENT_CREATED')
  const ocrCompleted   = findEvt('OCR_COMPLETED')
  const wfStarted      = findEvt('WORKFLOW_STARTED')
  const taskClaimed    = findEvt('TASK_CLAIMED')
  const taskApproved   = findEvt('TASK_APPROVED')
  const taskRejected   = findEvt('TASK_REJECTED')
  const taskInfoReq    = findEvt('TASK_INFO_REQUESTED')
  const wfCompleted    = findEvt('WORKFLOW_COMPLETED')

  const hasWorkflow = !!(activeWorkflow || wfStarted || wfCompleted)

  // OCR status
  const ocrDone = !!ocrCompleted || doc?.ocrCompleted
  const ocrFailed = doc?.status === 'OCR_FAILED'

  // Workflow status
  const wfStatus = activeWorkflow?.status

  return (
    <div className="p-4 space-y-6">
      {/* ── Graph Legend ── */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Pending</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> Active</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Done</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Rejected</span>
      </div>

      {/* ── Root Node ── */}
      <div className="flex items-start gap-0">
        <Node label="Uploaded" ts={fmtTs(docCreated?.timestamp || doc?.createdAt)}
              color="purple" icon={FileText} />

        <div className="flex flex-col gap-4 ml-2">
          {/* ── OCR Branch ── */}
          <div className="flex items-center gap-0">
            {/* Branch connector */}
            <div className="w-6 flex flex-col items-center">
              <div className="w-px h-3 bg-gray-300" />
              <div className="w-6 border-t-2 border-gray-300 border-dashed" />
            </div>

            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-teal-50/50 border border-teal-100">
              <span className="text-[10px] font-bold text-teal-600 mr-1 shrink-0">OCR</span>
              <Connector color="teal" />
              <Node label={ocrFailed ? 'Failed' : 'Extract'}
                    ts={fmtTs(ocrCompleted?.timestamp)}
                    color={ocrFailed ? 'red' : ocrDone ? 'teal' : 'gray'}
                    pulse={!ocrDone && !ocrFailed}
                    icon={Scan} />
              <Connector color={ocrDone ? 'teal' : 'gray'} />
              <Node label={ocrFailed ? 'Error' : ocrDone ? 'Done' : 'Pending'}
                    color={ocrFailed ? 'red' : ocrDone ? 'green' : 'gray'}
                    icon={ocrDone ? CheckCircle : ocrFailed ? XCircle : Clock} />
            </div>
          </div>

          {/* ── Workflow Branch (only if workflow exists) ── */}
          {hasWorkflow && (
            <div className="flex items-center gap-0">
              <div className="w-6 flex flex-col items-center">
                <div className="w-px h-3 bg-gray-300" />
                <div className="w-6 border-t-2 border-indigo-300 border-dashed" />
              </div>

              <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-50/50 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 mr-1 shrink-0">Review</span>

                {/* Queued */}
                <Connector color="indigo" />
                <Node label="Queued"
                      ts={fmtTs(wfStarted?.timestamp)}
                      color={wfStarted ? 'indigo' : 'gray'}
                      icon={Play} />

                {/* Claimed */}
                <Connector color={taskClaimed ? 'blue' : 'gray'} />
                <Node label="Claimed"
                      sub={taskClaimed?.actor ? taskClaimed.actor.split('@')[0] : null}
                      ts={fmtTs(taskClaimed?.timestamp)}
                      color={taskClaimed ? 'blue' : 'gray'}
                      pulse={wfStatus === 'ACTIVE' && !!taskClaimed}
                      icon={UserCheck} />

                {/* Decision */}
                <Connector color={
                  taskApproved || wfStatus === 'COMPLETED_APPROVED' ? 'green' :
                  taskRejected || wfStatus === 'COMPLETED_REJECTED' ? 'red' :
                  taskInfoReq || wfStatus === 'INFO_REQUESTED' ? 'amber' : 'gray'
                } />
                <Node
                  label={
                    taskApproved || wfStatus === 'COMPLETED_APPROVED' ? 'Approved' :
                    taskRejected || wfStatus === 'COMPLETED_REJECTED' ? 'Rejected' :
                    taskInfoReq || wfStatus === 'INFO_REQUESTED' ? 'Info Req.' :
                    'Pending'
                  }
                  sub={
                    (taskApproved?.actor || taskRejected?.actor || taskInfoReq?.actor)
                      ? (taskApproved?.actor || taskRejected?.actor || taskInfoReq?.actor).split('@')[0]
                      : null
                  }
                  ts={fmtTs(taskApproved?.timestamp || taskRejected?.timestamp || wfCompleted?.timestamp)}
                  color={
                    taskApproved || wfStatus === 'COMPLETED_APPROVED' ? 'green' :
                    taskRejected || wfStatus === 'COMPLETED_REJECTED' ? 'red' :
                    taskInfoReq || wfStatus === 'INFO_REQUESTED' ? 'amber' : 'gray'
                  }
                  icon={
                    taskApproved || wfStatus === 'COMPLETED_APPROVED' ? CheckCircle :
                    taskRejected || wfStatus === 'COMPLETED_REJECTED' ? XCircle :
                    taskInfoReq ? MessageSquare : Clock
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Log (collapsed details) ── */}
      {events.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Show {events.length} event{events.length !== 1 ? 's' : ''} (raw log)
          </summary>
          <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-100">
            {events.map((evt, i) => (
              <div key={i} className="flex items-baseline gap-2 text-[10px]">
                <span className="text-gray-300 font-mono shrink-0">{fmtTs(evt.timestamp)}</span>
                <span className="text-gray-600">{evt.description}</span>
                {evt.actor && <span className="text-gray-400">by {evt.actor}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
