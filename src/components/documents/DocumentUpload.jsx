/**
 * DocumentUpload.jsx
 *
 * Sprint-C: Added Segment → Product Line cascading selects in the metadata panel.
 * The hierarchy is fetched from GET /api/admin/hierarchy.
 * On segment change, the product line dropdown resets.
 * Sprint-D fix: restored partyExternalId selector (was dropped during Sprint-C hierarchy changes).
 * Sprint-E refactor: replaced flat party <select> (eager-loaded all customers) with the shared
 *   <PartySearch> widget (components/common/PartySearch). Now fetches lazily on keystroke.
 *   partyExternalId sent to backend is unchanged — selectedParty?.externalId.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, ChevronUp, ChevronDown, Layers, GitBranch, Building2 } from 'lucide-react'
import { uploadDocuments } from '../../api/documentsApi'
import { useHierarchy, useCategories } from '../../hooks/useAdmin'
import PartySearch from '../common/PartySearch'
import toast from 'react-hot-toast'

const MAX_FILE_SIZE_MB = 50
const ACCEPTED_MIME = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
]

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function getFileIcon(type) {
  const t = type ?? ''
  if (t.includes('pdf')) return '📄'
  if (t.includes('word') || t.includes('document')) return '📝'
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv')) return '📊'
  if (t.includes('presentation') || t.includes('powerpoint')) return '📋'
  if (t.startsWith('image/')) return '🖼️'
  return '📁'
}

function FileRow({ file, status, progress, error, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
      <span className="text-xl shrink-0">{getFileIcon(file.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
        {status === 'uploading' && (
          <div className="mt-1.5 h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}
        {status === 'error' && error && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={11} /> {error}
          </p>
        )}
      </div>
      <div className="shrink-0">
        {status === 'idle'      && <button onClick={() => onRemove(file.name)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>}
        {status === 'uploading' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
        {status === 'done'      && <CheckCircle2 size={16} className="text-emerald-500" />}
        {status === 'error'     && <AlertCircle size={16} className="text-red-500" />}
      </div>
    </div>
  )
}

const selectCls = 'w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400'

export default function DocumentUpload({ onUploadComplete }) {
  const [dragging,   setDragging]   = useState(false)
  const [fileStates, setFileStates] = useState([])
  const [uploading,  setUploading]  = useState(false)
  const [showMeta,   setShowMeta]   = useState(true)

  // ── Hierarchy selects (Sprint-C) ──────────────────────────────────────────
  const [segmentId,        setSegmentId]        = useState('')
  const [productLineId,    setProductLineId]    = useState('')
  const [categoryId,       setCategoryId]       = useState('')
  const [docName,          setDocName]          = useState('')
  // ── Party (Sprint-E: full party object instead of bare externalId string)
  // selectedParty = PartyDto | null.  We extract .externalId when building uploadMeta.
  const [selectedParty,    setSelectedParty]    = useState(null)

  const { data: hierarchy = [] }     = useHierarchy()
  const { data: allCategories = [] } = useCategories(true)

  // Derived product lines for the currently selected segment
  const selectedSegment = hierarchy.find(n => String(n.segmentId) === String(segmentId))
  const productLines    = selectedSegment?.productLines ?? []

  // Filter categories by chosen product line (if it has products with categories, use that;
  // otherwise show all categories as fallback)
  const filteredCategories = productLineId
    ? allCategories.filter(c => !c.productLineId || String(c.productLineId) === String(productLineId))
    : allCategories

  const handleSegmentChange = (val) => {
    setSegmentId(val)
    setProductLineId('')
    setCategoryId('')
  }

  const inputRef = useRef(null)
  const resetInput = () => { if (inputRef.current) inputRef.current.value = '' }

  const validateFile = (file) => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Unsupported file type'
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_FILE_SIZE_MB} MB`
    return null
  }

  const addFiles = useCallback((incoming) => {
    const next = [...incoming].map(file => {
      const err = validateFile(file)
      return { file, status: err ? 'error' : 'idle', progress: 0, error: err }
    })
    setFileStates(prev => {
      const existing = new Set(prev.map(f => f.file.name))
      return [...prev, ...next.filter(n => !existing.has(n.file.name))]
    })
    resetInput()
  }, [])

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }, [addFiles])
  const removeFile = (name) => setFileStates(prev => prev.filter(f => f.file.name !== name))
  const patchFile  = (name, patch) => setFileStates(prev => prev.map(f => f.file.name === name ? { ...f, ...patch } : f))

  async function handleUpload() {
    const ready = fileStates.filter(f => f.status === 'idle')
    if (!ready.length || uploading) return
    setUploading(true)

    // Resolve codes from the hierarchy tree for MinIO path building
    const selectedPl = productLines.find(pl => String(pl.id) === String(productLineId))

    const uploadMeta = {
      name:            docName || undefined,
      categoryId:      categoryId || undefined,
      segmentId:       segmentId || undefined,
      productLineId:   productLineId || undefined,
      segmentCode:     selectedSegment?.segmentCode || undefined,
      productLineCode: selectedPl?.code || undefined,
      partyExternalId: selectedParty?.externalId || selectedParty?.customerRef || undefined,
    }

    let successCount = 0
    let failCount    = 0

    await Promise.allSettled(ready.map(async ({ file }) => {
      patchFile(file.name, { status: 'uploading', progress: 0 })
      try {
        await uploadDocuments([file], uploadMeta, pct => patchFile(file.name, { progress: pct }))
        patchFile(file.name, { status: 'done', progress: 100 })
        successCount++
      } catch (err) {
        patchFile(file.name, { status: 'error', error: err.message })
        failCount++
      }
    }))

    setUploading(false)
    resetInput()
    if (successCount > 0 && failCount === 0) {
      toast.success(`${successCount} file${successCount !== 1 ? 's' : ''} uploaded`)
      onUploadComplete?.()
    } else if (successCount > 0) {
      toast.success(`${successCount} uploaded`)
      toast.error(`${failCount} failed`)
      onUploadComplete?.()
    } else {
      toast.error(`Upload failed for all ${failCount} file${failCount !== 1 ? 's' : ''}`)
    }
  }

  const clearDone = () => { setFileStates(prev => prev.filter(f => f.status !== 'done')); resetInput() }
  const clearAll  = () => { setFileStates([]); resetInput() }
  const idleCount = fileStates.filter(f => f.status === 'idle').length
  const hasIdle   = idleCount > 0
  const hasDone   = fileStates.some(f => f.status === 'done')

  return (
    <div className="space-y-4">

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-xl border-2 border-dashed cursor-pointer select-none',
          'transition-all duration-200 py-12 px-6 text-center',
          dragging
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : 'border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/40',
        ].join(' ')}
      >
        <div className={[
          'flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200',
          dragging ? 'bg-blue-100' : 'bg-white shadow-sm border border-gray-100',
        ].join(' ')}>
          <Upload size={24} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">{dragging ? 'Drop files here' : 'Drag & drop files'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            or <span className="text-blue-500 font-medium">browse</span>
            {' · PDF, Word, Excel, images · max '}{MAX_FILE_SIZE_MB} MB
          </p>
        </div>
        <input
          ref={inputRef} type="file" multiple
          accept={ACCEPTED_MIME.join(',')}
          className="sr-only"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* ── File list ──────────────────────────────────────────────────── */}
      {fileStates.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {fileStates.map(({ file, status, progress, error }) => (
            <FileRow key={file.name} file={file} status={status} progress={progress} error={error} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* ── Document context panel ─────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <button type="button" onClick={() => setShowMeta(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <span className="font-medium">
            Document context
            {(segmentId || categoryId || selectedParty) ? ' ✓' : ' (optional)'}
          </span>
          {showMeta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showMeta && (
          <div className="px-4 pb-4 pt-2 space-y-4">

            {/* Document name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Document name</label>
              <input
                type="text" value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="Leave blank to use filename"
                className={selectCls}
              />
            </div>

            {/* ── Party (Sprint-E: shared PartySearch widget) ───────── */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                <Building2 size={12} /> Party / Customer
              </label>
              <PartySearch
                value={selectedParty}
                onChange={setSelectedParty}
                size="compact"
                autoSearch={true}
                maxResults={10}
                showHint={true}
                placeholder="Type name or ID to search…"
              />
            </div>

            {/* ── Hierarchy: Segment → Product Line → Category ─────────── */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                <Layers size={12} /> Location Hierarchy
              </label>
              <div className="grid grid-cols-3 gap-2">

                {/* Segment */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Segment</label>
                  <select
                    value={segmentId}
                    onChange={e => handleSegmentChange(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">All segments</option>
                    {hierarchy.map(n => (
                      <option key={n.segmentId} value={n.segmentId}>{n.segmentName}</option>
                    ))}
                  </select>
                </div>

                {/* Product Line */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product Line</label>
                  <select
                    value={productLineId}
                    onChange={e => { setProductLineId(e.target.value); setCategoryId('') }}
                    disabled={!segmentId}
                    className={selectCls}
                  >
                    <option value="">All product lines</option>
                    {productLines.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category <span className="text-blue-500">(drives OCR fields)</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">No category</option>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Breadcrumb preview */}
              {(segmentId || productLineId || categoryId) && (
                <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                  <GitBranch size={10} />
                  {[
                    selectedSegment?.segmentName,
                    productLines.find(pl => String(pl.id) === String(productLineId))?.name,
                    filteredCategories.find(c => String(c.id) === String(categoryId))?.name,
                  ].filter(Boolean).join(' › ')}
                </p>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {fileStates.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          {hasDone && (
            <button onClick={clearDone} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Clear completed
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={clearAll} disabled={uploading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Clear all
            </button>
            <button
              onClick={handleUpload} disabled={!hasIdle || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {uploading && <Loader2 size={14} className="animate-spin" />}
              {uploading ? 'Uploading…' : `Upload ${idleCount} file${idleCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}