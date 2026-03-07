/**
 * DocumentsPage.jsx
 * Route: /documents
 *
 * Modes:
 *   browse — shows DocumentUpload (toggle) + DocumentTable
 *   search — shows DocumentSearchPanel (Sprint-E full-text search)
 *
 * Upload toggle and Search toggle live together in the page header action bar.
 */
import { useState } from 'react'
import { Upload, X, Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import DocumentUpload from '../../components/documents/DocumentUpload'
import DocumentTable from '../../components/documents/DocumentTable'
import DocumentSearchPanel from '../../components/documents/DocumentSearchPanel'

export default function DocumentsPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [mode, setMode] = useState('browse') // 'browse' | 'search'
  const qc = useQueryClient()

  const handleUploadComplete = () => {
    // Invalidate all document list queries so DocumentTable refreshes
    qc.invalidateQueries({ queryKey: ['documents'] })
    // Keep panel open so user sees per-file "done" status
  }

  const handleToggleSearch = () => {
    setMode(m => m === 'search' ? 'browse' : 'search')
    // Close upload panel when entering search mode
    if (mode !== 'search') setShowUpload(false)
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage, search and download your organisation's documents
          </p>
        </div>

        {/* Action buttons — Search toggle + Upload toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSearch}
            className={[
              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              mode === 'search'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            <Search size={15} />
            {mode === 'search' ? 'Exit Search' : 'Search'}
          </button>

          {mode === 'browse' && (
            <button
              onClick={() => setShowUpload(v => !v)}
              className={[
                'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all shadow-sm',
                showUpload
                  ? 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              ].join(' ')}
            >
              {showUpload
                ? <><X size={16} /> Close Upload</>
                : <><Upload size={16} /> Upload</>}
            </button>
          )}
        </div>
      </div>

      {/* ── Search mode ───────────────────────────────────────── */}
      {mode === 'search' && (
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ minHeight: '60vh' }}
        >
          <DocumentSearchPanel onClose={() => setMode('browse')} />
        </div>
      )}

      {/* ── Browse mode ───────────────────────────────────────── */}
      {mode === 'browse' && (
        <>
          {/* Upload panel (toggled) */}
          {showUpload && (
            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Upload Documents</h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close upload panel"
                >
                  <X size={16} />
                </button>
              </div>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>
          )}

          {/* Document list */}
          <ErrorBoundary>
            <DocumentTable />
          </ErrorBoundary>
        </>
      )}

    </div>
  )
}