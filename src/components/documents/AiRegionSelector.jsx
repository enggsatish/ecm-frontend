/**
 * AiRegionSelector.jsx
 *
 * Visual OCR training tool — draw a rectangle on a document image
 * and ask GLM-OCR to read, identify, or label the selected region.
 *
 * Layout: two-column — image (left, fitted to container), controls + results (right).
 * Image container clips to exact image bounds — no dead space for selection to leak into.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, Scan, Tag, CheckCircle, Type, Eye, Save, Trash2, Database, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { classifyDocument } from '../../api/documentsApi'
import { getCategories } from '../../api/adminApi'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const DEFAULT_FIELDS = [
  'full_name', 'first_name', 'last_name', 'date_of_birth', 'expiry_date',
  'document_number', 'address', 'sex', 'nationality', 'account_number',
  'invoice_number', 'invoice_date', 'amount_due', 'vendor_name',
  'merchant_name', 'total', 'employer_name', 'tax_year',
  'height', 'weight', 'eye_color', 'hair_color', 'class', 'issuer',
  'issue_date', 'phone', 'email', 'signature_present',
]

export default function AiRegionSelector({ documentId, previewUrl, mimeType, categoryId: initialCategoryId }) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId)
  const [reclassifying, setReclassifying] = useState(false)
  const [drawing, setDrawing] = useState(false)

  // Load all categories for the dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['admin', 'categories', true],
    queryFn: () => getCategories(true),
    staleTime: 5 * 60_000,
  })

  const categoryDirty = selectedCategoryId !== initialCategoryId

  // Save classification — only when user clicks Save
  const saveClassification = async () => {
    if (!selectedCategoryId) return
    setReclassifying(true)
    try {
      await classifyDocument(documentId, { categoryId: selectedCategoryId })
      loadExamples()
      toast.success('Document reclassified')
    } catch (err) {
      toast.error('Reclassify failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setReclassifying(false)
    }
  }
  const [startPos, setStartPos] = useState(null)
  const [region, setRegion] = useState(null)
  const [regionPx, setRegionPx] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [labelField, setLabelField] = useState('')
  const [saving, setSaving] = useState(false)
  const [customFields, setCustomFields] = useState([])
  const [addingField, setAddingField] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [examples, setExamples] = useState([])
  const [examplesLoaded, setExamplesLoaded] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })

  // PDF-specific state
  const isPdf = mimeType === 'application/pdf'
  const [pdfDoc, setPdfDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfImageUrl, setPdfImageUrl] = useState(null)

  // Load PDF and render first page as image
  useEffect(() => {
    if (!isPdf || !documentId) return
    setPdfLoading(true)

    // Fetch PDF blob via document download endpoint
    apiClient.get(`/api/documents/${documentId}/download`, { responseType: 'blob' })
      .then(res => {
        const blob = res.data
        return blob.arrayBuffer()
      })
      .then(buffer => pdfjsLib.getDocument({ data: buffer }).promise)
      .then(pdf => {
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        renderPdfPage(pdf, 1)
      })
      .catch(err => {
        console.error('PDF load failed:', err)
        setPdfLoading(false)
      })

    return () => { if (pdfImageUrl) URL.revokeObjectURL(pdfImageUrl) }
  }, [isPdf, documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderPdfPage = useCallback(async (pdf, pageNum) => {
    try {
      const page = await pdf.getPage(pageNum)
      const scale = 2.0 // high-res for readability
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      await page.render({ canvasContext: ctx, viewport }).promise

      // Convert canvas to blob URL for <img> rendering
      canvas.toBlob(blob => {
        if (pdfImageUrl) URL.revokeObjectURL(pdfImageUrl)
        const url = URL.createObjectURL(blob)
        setPdfImageUrl(url)
        setImgSize({ w: viewport.width, h: viewport.height })
        setPdfLoading(false)
      }, 'image/png')
    } catch (err) {
      console.error('PDF page render failed:', err)
      setPdfLoading(false)
    }
  }, [pdfImageUrl])

  const changePdfPage = (delta) => {
    const newPage = currentPage + delta
    if (newPage < 1 || newPage > totalPages || !pdfDoc) return
    setCurrentPage(newPage)
    setPdfLoading(true)
    clearSelection()
    renderPdfPage(pdfDoc, newPage)
  }

  // Auto-load training examples filtered by selected category
  const loadExamples = useCallback(() => {
    const params = selectedCategoryId ? `?categoryId=${selectedCategoryId}` : ''
    apiClient.get('/api/ocr/training-examples' + params)
      .then(r => { setExamples(r.data?.data ?? r.data ?? []); setExamplesLoaded(true) })
      .catch(() => { setExamples([]); setExamplesLoaded(true) })
  }, [selectedCategoryId])

  useEffect(() => { loadExamples() }, [loadExamples])

  const deleteExample = async (id) => {
    try {
      await apiClient.delete(`/api/ocr/training-examples/${id}`)
      toast.success('Training example deleted')
      loadExamples()
    } catch { toast.error('Delete failed') }
  }

  // Capture actual rendered image size
  const onImageLoad = useCallback((e) => {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })
  }, [])

  // Clamp mouse position to image bounds
  const clampToImage = useCallback((clientX, clientY) => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
    return { x, y }
  }, [])

  const handleMouseDown = useCallback((e) => {
    const pos = clampToImage(e.clientX, e.clientY)
    if (!pos) return
    setStartPos(pos)
    setDrawing(true)
    setRegion(null)
    setRegionPx(null)
    setResult(null)
  }, [clampToImage])

  const handleMouseMove = useCallback((e) => {
    if (!drawing || !startPos) return
    const pos = clampToImage(e.clientX, e.clientY)
    if (!pos) return
    setRegionPx({
      x: Math.min(startPos.x, pos.x), y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x), height: Math.abs(pos.y - startPos.y),
    })
  }, [drawing, startPos, clampToImage])

  const handleMouseUp = useCallback(() => {
    if (!drawing || !regionPx || !containerRef.current) { setDrawing(false); return }
    setDrawing(false)
    const el = containerRef.current
    const normalized = {
      x: regionPx.x / el.clientWidth, y: regionPx.y / el.clientHeight,
      width: regionPx.width / el.clientWidth, height: regionPx.height / el.clientHeight,
    }
    if (normalized.width < 0.01 || normalized.height < 0.01) { setRegionPx(null); setRegion(null); return }
    setRegion(normalized)
  }, [drawing, regionPx])

  const clearSelection = () => { setRegion(null); setRegionPx(null); setResult(null); setLabelField('') }

  const analyzeRegion = async (action) => {
    if (!region || !documentId) return
    setAnalyzing(true); setResult(null)
    try {
      const res = await apiClient.post('/api/ocr/analyze-region', { documentId, page: currentPage, region, action })
      setResult(res.data?.data ?? res.data)
    } catch (err) {
      toast.error('Analysis failed: ' + (err.response?.data?.error || err.message))
    } finally { setAnalyzing(false) }
  }

  const saveAsTraining = async () => {
    if (!result?.text || !labelField) return
    setSaving(true)
    try {
      await apiClient.post('/api/ocr/training-examples', {
        documentId, categoryId: selectedCategoryId || null,
        fieldName: labelField, confirmedValue: result.text, page: 1, region,
      })
      toast.success(`Saved: ${labelField} = "${result.text}"`)
      setLabelField('')
      loadExamples()
    } catch (err) {
      toast.error('Save failed: ' + (err.response?.data?.error || err.message))
    } finally { setSaving(false) }
  }

  const displayUrl = isPdf ? pdfImageUrl : previewUrl

  if (!displayUrl && !pdfLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Scan size={32} className="mb-2 opacity-50" />
        <p className="text-sm">{isPdf ? 'Loading PDF...' : 'No preview available for AI analysis'}</p>
      </div>
    )
  }

  if (pdfLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin mb-2" />
        <p className="text-sm">Rendering PDF page {currentPage}...</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT: Document image with selection */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Zoom + page controls */}
        <div className="flex items-center gap-1 pb-1.5 flex-shrink-0">
          <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] text-gray-400 w-8 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
            <ZoomIn size={14} />
          </button>
          {isPdf && totalPages > 1 && (
            <>
              <span className="mx-1 text-gray-200">|</span>
              <button onClick={() => changePdfPage(-1)} disabled={currentPage <= 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] text-gray-400">{currentPage}/{totalPages}</span>
              <button onClick={() => changePdfPage(1)} disabled={currentPage >= totalPages}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </>
          )}
          {region && (
            <button onClick={clearSelection}
              className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 cursor-pointer">
              <Trash2 size={10} /> Clear
            </button>
          )}
        </div>

        {/* Image viewport — scrollable, image inside is exact-fit */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 bg-gray-100 flex items-start justify-center p-2">
          <div
            ref={containerRef}
            className="relative cursor-crosshair select-none shrink-0"
            style={{ width: imgSize.w ? `${imgSize.w * zoom / 100}px` : 'auto' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { if (drawing) { setDrawing(false); setRegionPx(null) } }}
          >
            <img
              ref={imgRef}
              src={displayUrl}
              alt="Document"
              onLoad={onImageLoad}
              className="block w-full h-auto"
              draggable={false}
            />
            {regionPx && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none"
                style={{ left: regionPx.x, top: regionPx.y, width: regionPx.width, height: regionPx.height }}
              />
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Controls + Results panel */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-auto">
        {/* Category selector */}
        <div className={`bg-white border rounded-lg p-2.5 ${categoryDirty ? 'border-amber-300' : 'border-gray-200'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Layers size={12} className="text-gray-400" />
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Document Type</span>
          </div>
          <select
            value={selectedCategoryId || ''}
            onChange={e => setSelectedCategoryId(parseInt(e.target.value) || null)}
            disabled={reclassifying}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Not classified</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
          {categoryDirty && (
            <button onClick={saveClassification} disabled={reclassifying}
              className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
              {reclassifying ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save Classification
            </button>
          )}
          {!categoryDirty && (
            <p className="text-[9px] text-gray-400 mt-1">
              Select the correct document type, then save.
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Scan size={12} className="shrink-0" />
          Draw a rectangle on the image, then use the actions below.
        </div>

        {/* Action buttons */}
        {region && !analyzing && (
          <div className="flex flex-col gap-1.5">
            <button onClick={() => analyzeRegion('READ')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors w-full">
              <Type size={13} /> Read Text
            </button>
            <button onClick={() => analyzeRegion('IDENTIFY')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 cursor-pointer transition-colors w-full">
              <Eye size={13} /> Identify Content
            </button>
          </div>
        )}

        {!region && !result && (
          <div className="text-center py-6 text-gray-300">
            <Scan size={24} className="mx-auto mb-1.5 opacity-50" />
            <p className="text-[10px]">Select an area on the document</p>
          </div>
        )}

        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-blue-600">
            <Loader2 size={14} className="animate-spin" /> Analyzing...
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
            <div className="flex items-start gap-1.5">
              <CheckCircle size={13} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-gray-400 uppercase">{result.action === 'IDENTIFY' ? 'Identified' : 'Text'}</p>
                <p className="text-xs text-gray-900 font-mono bg-gray-50 rounded px-1.5 py-1 mt-0.5 break-all leading-relaxed">
                  {result.text || '(empty)'}
                </p>
              </div>
            </div>

            {result.text && (
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <p className="text-[9px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                  <Tag size={9} /> Save as training
                </p>
                {!addingField ? (
                  <div className="flex gap-1">
                    <select value={labelField} onChange={e => {
                      if (e.target.value === '__add_new__') { setAddingField(true); setLabelField('') }
                      else setLabelField(e.target.value)
                    }}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Field name...</option>
                      {[...DEFAULT_FIELDS, ...customFields].map(f => <option key={f} value={f}>{f}</option>)}
                      <option disabled>────────────</option>
                      <option value="__add_new__">+ Add custom field</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      placeholder="e.g. height_cm"
                      autoFocus
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newFieldName.length >= 2) {
                          setCustomFields(prev => prev.includes(newFieldName) ? prev : [...prev, newFieldName])
                          setLabelField(newFieldName)
                          setNewFieldName('')
                          setAddingField(false)
                        }
                        if (e.key === 'Escape') { setAddingField(false); setNewFieldName('') }
                      }}
                    />
                    <button onClick={() => {
                      if (newFieldName.length >= 2) {
                        setCustomFields(prev => prev.includes(newFieldName) ? prev : [...prev, newFieldName])
                        setLabelField(newFieldName)
                        setNewFieldName('')
                        setAddingField(false)
                      }
                    }}
                      disabled={newFieldName.length < 2}
                      className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                      Add
                    </button>
                    <button onClick={() => { setAddingField(false); setNewFieldName('') }}
                      className="px-1.5 py-1.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                <button onClick={saveAsTraining} disabled={!labelField || saving}
                  className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Example
                </button>
              </div>
            )}
          </div>
        )}

        {/* Training data — filtered by selected category */}
        <div className="mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Database size={11} className="text-gray-400" />
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
              Training Data
            </span>
            {examplesLoaded && (
              <span className="text-[9px] text-gray-400">
                {examples.length} example{examples.length !== 1 ? 's' : ''}
                {selectedCategoryId ? '' : ' (all categories)'}
              </span>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-auto max-h-52">
            {!examplesLoaded ? (
              <div className="flex items-center justify-center py-3 text-gray-400">
                <Loader2 size={12} className="animate-spin mr-1.5" /> <span className="text-[10px]">Loading...</span>
              </div>
            ) : examples.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-3">
                No training examples{selectedCategoryId ? ' for this category' : ''}.<br />
                Select areas and save to teach the model.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {examples.map(ex => {
                  let fields = {}
                  try {
                    let o = ex.expected_output
                    if (typeof o === 'string') o = JSON.parse(o)
                    // Handle nested structures: {fields: {}} or direct {key: val}
                    if (o?.fields && typeof o.fields === 'object') {
                      fields = o.fields
                    } else if (typeof o === 'object' && !Array.isArray(o)) {
                      // Maybe the output IS the fields directly (no wrapper)
                      const { category: _c, confidence: _conf, ...rest } = o
                      fields = Object.keys(rest).length > 0 ? rest : {}
                    }
                  } catch { /* skip */ }
                  const fieldEntries = Object.entries(fields)
                  return (
                    <div key={ex.id} className="p-1.5 hover:bg-white group">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <span className={`px-1 py-px rounded text-[7px] font-medium ${
                            ex.source === 'AZURE' ? 'bg-blue-50 text-blue-500'
                              : ex.source === 'REGION' ? 'bg-violet-50 text-violet-500'
                              : 'bg-gray-100 text-gray-500'
                          }`}>{ex.source === 'AZURE' ? 'Auto' : 'Manual'}</span>
                          <span className="text-[8px] text-gray-400">{ex.category_code}</span>
                          <span className="text-[8px] text-gray-300">{fieldEntries.length} field{fieldEntries.length !== 1 ? 's' : ''}</span>
                        </div>
                        <button onClick={() => deleteExample(ex.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 cursor-pointer transition-opacity">
                          <Trash2 size={10} />
                        </button>
                      </div>
                      {fieldEntries.length > 0 ? fieldEntries.map(([k, v]) => (
                        <div key={k} className="flex items-start gap-1 text-[9px]">
                          <span className="text-gray-400 shrink-0 w-20 truncate text-right" title={k}>{k}</span>
                          <span className="text-gray-300">:</span>
                          <span className="font-mono text-gray-600 truncate"
                                title={typeof v === 'string' ? v : JSON.stringify(v)}>
                            {(typeof v === 'string' ? v : JSON.stringify(v)).substring(0, 30)}
                          </span>
                        </div>
                      )) : (
                        <p className="text-[8px] text-gray-400 font-mono truncate"
                           title={JSON.stringify(ex.expected_output)}>
                          {JSON.stringify(ex.expected_output).substring(0, 60)}...
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
