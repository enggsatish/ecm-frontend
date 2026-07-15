/**
 * PdfAnnotationViewer.jsx
 *
 * Renders PDF pages using pdf.js canvas with annotation pin overlay.
 * When caseId is provided and case is active, users can click to add annotations.
 * Otherwise, annotations are view-only.
 *
 * Features:
 *   - pdf.js canvas rendering (page-by-page)
 *   - Click-to-place annotation pins
 *   - Comment popup on pin click
 *   - Reply threads
 *   - Resolve/unresolve annotations
 *   - Annotation list sidebar
 */
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare, Check, X, ChevronLeft, ChevronRight, Plus, Loader2,
  MapPin, CheckCircle, CornerDownRight, Trash2, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/apiClient'

// ── pdf.js setup ────────────────────────────────────────────────────────────
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// ── API calls ───────────────────────────────────────────────────────────────
const fetchAnnotations = (documentId, caseId) =>
  apiClient.get(`/api/documents/${documentId}/annotations`, { params: { caseId } })
    .then(r => r.data?.data ?? r.data ?? [])

const fetchReplies = (documentId, annotationId) =>
  apiClient.get(`/api/documents/${documentId}/annotations/${annotationId}/replies`)
    .then(r => r.data?.data ?? r.data ?? [])

const createAnnotation = (documentId, payload) =>
  apiClient.post(`/api/documents/${documentId}/annotations`, payload)
    .then(r => r.data?.data ?? r.data)

const resolveAnnotation = (documentId, annotationId) =>
  apiClient.put(`/api/documents/${documentId}/annotations/${annotationId}/resolve`)

const unresolveAnnotation = (documentId, annotationId) =>
  apiClient.put(`/api/documents/${documentId}/annotations/${annotationId}/unresolve`)

const deleteAnnotation = (documentId, annotationId) =>
  apiClient.delete(`/api/documents/${documentId}/annotations/${annotationId}`)

// ── Main Component ──────────────────────────────────────────────────────────
export default function PdfAnnotationViewer({ documentId, downloadUrl, caseId, canAnnotate = false }) {
  const qc = useQueryClient()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addingMode, setAddingMode] = useState(false)
  const [pendingPin, setPendingPin] = useState(null) // { x, y } click position
  const [commentText, setCommentText] = useState('')
  const [selectedAnnotation, setSelectedAnnotation] = useState(null)
  const [showResolved, setShowResolved] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [pageRendering, setPageRendering] = useState(false)

  // Fetch annotations
  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', documentId, caseId],
    queryFn: () => fetchAnnotations(documentId, caseId),
    enabled: !!documentId,
    staleTime: 15_000,
  })

  // Current page annotations
  const pageAnnotations = annotations.filter(a => {
    if (!showResolved && a.resolved) return false
    return a.page_number === currentPage
  })

  const allAnnotationCount = annotations.length
  const unresolvedCount = annotations.filter(a => !a.resolved).length

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!downloadUrl && !documentId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    // Fetch PDF bytes via authenticated apiClient, then hand to pdf.js
    const fullUrl = downloadUrl || `/api/documents/${documentId}/download`

    let cancelled = false
    apiClient.get(fullUrl, { responseType: 'arraybuffer' })
      .then(response => {
        if (cancelled) return
        const uint8Array = new Uint8Array(response.data)
        return pdfjsLib.getDocument({ data: uint8Array }).promise
      })
      .then(pdf => {
        if (cancelled || !pdf) return
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('PDF load error:', err)
        setError('Failed to load PDF')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [downloadUrl, documentId])

  // ── Render Page ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageRendering(true)

    pdfDoc.getPage(currentPage).then(page => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')

      // Clear canvas before rendering to prevent ghost images
      canvas.width = viewport.width
      canvas.height = viewport.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const renderTask = page.render({ canvasContext: ctx, viewport })
      renderTask.promise.then(() => {
        if (!cancelled) setPageRendering(false)
      }).catch(() => {
        if (!cancelled) setPageRendering(false)
      })
    })

    return () => { cancelled = true }
  }, [pdfDoc, currentPage, scale])

  // ── Handle canvas click (add annotation) ──────────────────────────────────
  // NOT wrapped in useCallback — needs fresh closure over addingMode every render
  const handleCanvasClick = (e) => {
    if (!addingMode) return
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setPendingPin({ x, y })
    setCommentText('')
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (payload) => createAnnotation(documentId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', documentId] })
      setPendingPin(null)
      setCommentText('')
      setAddingMode(false)
      toast.success('Annotation added')
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to add annotation'),
  })

  const resolveMut = useMutation({
    mutationFn: (annId) => resolveAnnotation(documentId, annId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', documentId] })
      toast.success('Annotation resolved')
    },
  })

  const unresolveMut = useMutation({
    mutationFn: (annId) => unresolveAnnotation(documentId, annId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', documentId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (annId) => deleteAnnotation(documentId, annId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', documentId] })
      setSelectedAnnotation(null)
      toast.success('Annotation deleted')
    },
  })

  const handleSubmitAnnotation = () => {
    if (!pendingPin || !commentText.trim()) return
    createMut.mutate({
      caseId,
      pageNumber: currentPage,
      xPercent: pendingPin.x,
      yPercent: pendingPin.y,
      comment: commentText.trim(),
      parentId: null,
    })
  }

  // eslint-disable-next-line no-unused-vars
  const handleSubmitReply = (parentId) => {
    if (!commentText.trim()) return
    createMut.mutate({
      caseId,
      pageNumber: currentPage,
      xPercent: 0,
      yPercent: 0,
      comment: commentText.trim(),
      parentId,
    })
  }

  // ── Loading/Error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading PDF...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg">
        <span className="text-sm text-red-500">{error}</span>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full overflow-hidden" ref={containerRef}>
      {/* ── PDF Canvas Area ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-xs text-gray-600 tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom */}
            <select value={scale} onChange={e => setScale(Number(e.target.value))}
              className="text-xs border border-gray-300 rounded px-1 py-0.5">
              <option value={0.8}>80%</option>
              <option value={1.0}>100%</option>
              <option value={1.2}>120%</option>
              <option value={1.5}>150%</option>
            </select>

            {/* Annotation controls — only in case context */}
            {canAnnotate ? (
              <button onClick={() => { setAddingMode(m => !m); setPendingPin(null) }}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors
                  ${addingMode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50 hover:text-blue-600'}`}>
                <Plus size={12} />
                {addingMode ? 'Click on PDF...' : 'Add Comment'}
              </button>
            ) : (
              <span className="text-[10px] text-gray-400 italic">View only (open from case to annotate)</span>
            )}

            {/* Comments toggle */}
            <button onClick={() => setShowSidebar(v => !v)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors
                ${showSidebar
                  ? 'bg-gray-200 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
              <MessageSquare size={12} />
              {allAnnotationCount > 0
                ? `${unresolvedCount} comment${unresolvedCount !== 1 ? 's' : ''}`
                : 'Comments'}
            </button>
          </div>
        </div>

        {/* Canvas with pin overlay */}
        <div className="flex-1 overflow-auto bg-gray-100 p-2">
          <div className="relative inline-block shadow-lg shrink-0 mx-auto">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`block ${addingMode ? 'cursor-crosshair' : 'cursor-default'}`}
            />

            {/* Render annotation pins */}
            {pageAnnotations.map((ann, i) => (
              <button
                key={ann.id}
                onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(ann); setShowSidebar(true) }}
                style={{ left: `${ann.x_percent}%`, top: `${ann.y_percent}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                  flex items-center justify-center text-[9px] font-bold shadow-md border-2
                  transition-transform hover:scale-125 z-10
                  ${ann.resolved
                    ? 'bg-gray-200 border-gray-300 text-gray-500'
                    : selectedAnnotation?.id === ann.id
                      ? 'bg-blue-600 border-blue-700 text-white scale-125'
                      : 'bg-amber-400 border-amber-500 text-white'}`}
                title={`${ann.author_name}: ${ann.comment}`}
              >
                {i + 1}
              </button>
            ))}

            {/* Pending pin (not yet saved) */}
            {pendingPin && (
              <div
                style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-blue-700
                  flex items-center justify-center animate-pulse">
                  <Plus size={12} className="text-white" />
                </div>

                {/* Comment input popup */}
                <div className="absolute left-8 top-0 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-30">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add your comment..."
                    rows={3}
                    autoFocus
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none
                      focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                  />
                  <div className="flex items-center justify-end gap-1.5 mt-2">
                    <button onClick={() => { setPendingPin(null); setAddingMode(false) }}
                      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                    <button onClick={handleSubmitAnnotation}
                      disabled={!commentText.trim() || createMut.isPending}
                      className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                      {createMut.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {pageRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Annotation Sidebar (collapsible) ── */}
      {showSidebar && (
      <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0 animate-in slide-in-from-right">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <MessageSquare size={12} /> Comments ({allAnnotationCount})
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)}
                className="rounded border-gray-300 w-3 h-3" />
              Resolved
            </label>
            <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {annotations.filter(a => showResolved || !a.resolved).filter(a => !a.parent_id).length === 0 ? (
            <div className="p-4 text-xs text-gray-400 text-center">
              {canAnnotate ? 'Click "Add Comment" to start' : 'No comments. Open from a case to annotate.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {annotations
                .filter(a => showResolved || !a.resolved)
                .filter(a => !a.parent_id)
                .map((ann, i) => (
                <AnnotationCard
                  key={ann.id}
                  annotation={ann}
                  index={i + 1}
                  documentId={documentId}
                  caseId={caseId}
                  isSelected={selectedAnnotation?.id === ann.id}
                  canAnnotate={canAnnotate}
                  onSelect={() => {
                    setSelectedAnnotation(ann)
                    setCurrentPage(ann.page_number)
                  }}
                  onResolve={() => resolveMut.mutate(ann.id)}
                  onUnresolve={() => unresolveMut.mutate(ann.id)}
                  onDelete={() => deleteMut.mutate(ann.id)}
                  onReply={(text) => {
                    createMut.mutate({
                      caseId,
                      pageNumber: ann.page_number,
                      xPercent: ann.x_percent,
                      yPercent: ann.y_percent,
                      comment: text,
                      parentId: ann.id,
                    })
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// ── Annotation Card ──────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function AnnotationCard({ annotation: ann, index, documentId, caseId, isSelected,
                          canAnnotate, onSelect, onResolve, onUnresolve, onDelete, onReply }) {
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplies, setShowReplies] = useState(false)

  const { data: replies = [] } = useQuery({
    queryKey: ['annotation-replies', documentId, ann.id],
    queryFn: () => fetchReplies(documentId, ann.id),
    enabled: showReplies && !!ann.id,
    staleTime: 30_000,
  })

  const replyCount = ann.reply_count || 0

  return (
    <div
      onClick={onSelect}
      className={`p-2.5 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
    >
      <div className="flex items-start gap-2">
        {/* Pin number */}
        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold
          ${ann.resolved ? 'bg-gray-200 text-gray-500' : 'bg-amber-400 text-white'}`}>
          {index}
        </span>

        <div className="flex-1 min-w-0">
          {/* Author + page */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-700">
              {ann.author_name || ann.author_email?.split('@')[0]}
            </span>
            <span className="text-[9px] text-gray-400">p.{ann.page_number}</span>
          </div>

          {/* Comment */}
          <p className={`text-xs mt-0.5 leading-relaxed ${ann.resolved ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
            {ann.comment}
          </p>

          {/* Timestamp */}
          <span className="text-[9px] text-gray-300 mt-0.5 block">
            {ann.created_at ? new Date(ann.created_at).toLocaleString('en-CA', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : ''}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1.5">
            {canAnnotate && !ann.resolved && (
              <button onClick={(e) => { e.stopPropagation(); onResolve() }}
                className="text-[10px] text-green-600 hover:text-green-700 flex items-center gap-0.5">
                <CheckCircle size={10} /> Resolve
              </button>
            )}
            {canAnnotate && ann.resolved && (
              <button onClick={(e) => { e.stopPropagation(); onUnresolve() }}
                className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5">
                <RotateCcw size={10} /> Reopen
              </button>
            )}
            {canAnnotate && (
              <button onClick={(e) => { e.stopPropagation(); setShowReplyInput(v => !v) }}
                className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5">
                <CornerDownRight size={10} /> Reply
              </button>
            )}
            {replyCount > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setShowReplies(v => !v) }}
                className="text-[10px] text-blue-500 hover:text-blue-700">
                {showReplies ? 'Hide' : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
            {canAnnotate && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this annotation?')) onDelete() }}
                className="text-[10px] text-gray-300 hover:text-red-500 ml-auto">
                <Trash2 size={10} />
              </button>
            )}
          </div>

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-2 ml-2 space-y-1.5 border-l-2 border-gray-100 pl-2">
              {replies.map(reply => (
                <div key={reply.id} className="text-[10px]">
                  <span className="font-semibold text-gray-600">
                    {reply.author_name || reply.author_email?.split('@')[0]}
                  </span>
                  <p className="text-gray-500 mt-0.5">{reply.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
              <input value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Reply..." autoFocus
                className="flex-1 text-[10px] border border-gray-200 rounded px-1.5 py-1
                  focus:ring-1 focus:ring-blue-400"
                onKeyDown={e => {
                  if (e.key === 'Enter' && replyText.trim()) {
                    onReply(replyText.trim())
                    setReplyText('')
                    setShowReplyInput(false)
                  }
                }}
              />
              <button onClick={() => {
                if (replyText.trim()) {
                  onReply(replyText.trim())
                  setReplyText('')
                  setShowReplyInput(false)
                }
              }}
                className="px-1.5 py-1 text-[10px] text-white bg-blue-600 rounded hover:bg-blue-700">
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
