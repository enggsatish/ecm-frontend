/**
 * DocumentViewerModal.jsx  — Sprint-D fix
 *
 * Fixes applied:
 *
 * 1. Preview tab — iframe src can't use a bearer-auth URL directly.
 *    Browsers don't forward the Authorization header when loading iframe src.
 *    Fix: download the blob via Axios (which has the JWT interceptor), create
 *    an object URL, and set the iframe src to that. Object URL is revoked on
 *    close to avoid memory leaks.
 *
 * 2. Extracted Fields tab — was always empty because doc.extractedFields was
 *    undefined (field missing from DocumentResponse). Now that DocumentResponse
 *    includes extractedFields (a JSON string), we parse and display it here.
 *
 * 3. Metadata tab — NEW tab showing document metadata: party, category, segment,
 *    product line, size, uploader, timestamps. Gives users a place to see the
 *    full context of a document without opening a separate page.
 */
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle, FileText, User, Tag, MapPin, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDocument, downloadDocument } from '../../api/documentsApi'
import apiClient from '../../api/apiClient'

export default function DocumentViewerModal({ documentId, onClose }) {
  const [tab, setTab] = useState('preview')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const objectUrlRef = useRef(null)

  const { data: doc, isLoading } = useQuery({
    queryKey: ['documents', documentId],
    queryFn:  () => getDocument(documentId),
    enabled:  !!documentId,
  })

  // ── Fetch blob for preview ───────────────────────────────────────────────
  // Browsers don't forward Authorization headers in <iframe src>.
  // We download the file via Axios (which attaches the JWT), create an object URL,
  // and point the iframe at that. The object URL is revoked on unmount/tab-change.
  useEffect(() => {
    if (!doc || tab !== 'preview') return
    if (!isPrevieable(doc.mimeType)) {
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

  // ── Parse extractedFields ────────────────────────────────────────────────
  const extractedFields = (() => {
    if (!doc?.extractedFields) return {}
    if (typeof doc.extractedFields === 'object') return doc.extractedFields
    try { return JSON.parse(doc.extractedFields) } catch { return {} }
  })()

  const hasFields = Object.keys(extractedFields).length > 0

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [
    ['preview',  'Preview'],
    ['fields',   'Extracted Fields'],
    ['text',     'Raw Text'],
    ['metadata', 'Metadata'],
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
              {previewError  && <Center icon={<AlertCircle size={28} className="text-red-400" />} text={previewError} />}
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
              {!hasFields
                ? <p className="text-sm text-gray-400">No structured fields extracted yet. OCR may still be processing.</p>
                : Object.entries(extractedFields).map(([k, v]) => (
                    <div key={k} className="flex gap-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-44 flex-shrink-0">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-800">{String(v ?? '—')}</span>
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── Raw Text ── */}
          {!isLoading && tab === 'text' && (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {doc?.extractedText || 'No text extracted yet. OCR may still be processing.'}
            </pre>
          )}

          {/* ── Metadata ── */}
          {!isLoading && tab === 'metadata' && doc && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <MetaRow icon={<FileText size={13} />} label="Name"         value={doc.name} />
              <MetaRow icon={<FileText size={13} />} label="Original file" value={doc.originalFilename} />
              <MetaRow icon={<Tag size={13} />}      label="MIME type"    value={doc.mimeType} />
              <MetaRow icon={<Tag size={13} />}      label="Size"         value={doc.fileSizeBytes ? formatBytes(doc.fileSizeBytes) : '—'} />
              <MetaRow icon={<User size={13} />}     label="Uploaded by"  value={doc.uploadedByEmail} />
              <MetaRow icon={<User size={13} />}     label="Party"        value={doc.partyExternalId ?? '—'} />
              <MetaRow icon={<MapPin size={13} />}   label="Segment"      value={doc.segmentName ?? doc.segmentId ?? '—'} />
              <MetaRow icon={<MapPin size={13} />}   label="Product Line" value={doc.productLineName ?? doc.productLineId ?? '—'} />
              <MetaRow icon={<Tag size={13} />}      label="Category"     value={doc.categoryName ?? doc.categoryId ?? '—'} />
              <MetaRow icon={<Tag size={13} />}      label="Status"       value={doc.status} />
              <MetaRow icon={<Tag size={13} />}      label="Version"      value={doc.version} />
              <MetaRow icon={<Tag size={13} />}      label="OCR"          value={doc.ocrCompleted ? 'Complete' : 'Pending'} />
              <MetaRow icon={<Clock size={13} />}    label="Created"      value={doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'} />
              <MetaRow icon={<Clock size={13} />}    label="Updated"      value={doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : '—'} />
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPrevieable(mimeType) {
  if (!mimeType) return false
  return mimeType.includes('pdf') || mimeType.startsWith('image/')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
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
