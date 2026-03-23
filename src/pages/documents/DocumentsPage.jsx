/**
 * DocumentsPage.jsx
 * Route: /documents
 *
 * Modes:
 *   browse — shows DocumentUpload (toggle) + DocumentTable
 *   search — shows DocumentSearchPanel (Sprint-E full-text search)
 *
 * Accepts ?customer=EXTERNAL_ID query param to pre-filter by customer.
 */
import { useState } from 'react'
import { Upload, X, Search, ExternalLink } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { listCustomers } from '../../api/adminApi'
import ErrorBoundary from '../../components/common/ErrorBoundary'
import DocumentUpload from '../../components/documents/DocumentUpload'
import DocumentTable from '../../components/documents/DocumentTable'
import DocumentSearchPanel from '../../components/documents/DocumentSearchPanel'

function CustomerFilterBanner({ externalId, onClear }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['customer-by-ref', externalId],
    queryFn: () => listCustomers({ q: externalId, size: 5 }),
    staleTime: 10 * 60_000,
    enabled: !!externalId,
    throwOnError: false,
  })
  // API returns Page<PartyDto> → unwrap gives {content: [...]} or just [...]
  const customers = Array.isArray(data) ? data : (data?.content ?? [])
  const customer = customers.find(c => c.customerRef === externalId)

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-lg border border-indigo-100">
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-indigo-800">Showing documents for:</span>
        {isLoading ? (
          <span className="text-sm text-indigo-600">Loading...</span>
        ) : customer ? (
          <button onClick={() => navigate(`/customers/${customer.id}/portfolio`, { state: { from: '/documents', fromLabel: 'Documents' } })}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-sm font-semibold text-indigo-700 transition-colors cursor-pointer">
            {customer.displayName}
            <span className="font-mono text-xs text-indigo-500">({externalId})</span>
            <ExternalLink size={12} className="text-indigo-400" />
          </button>
        ) : (
          <span className="text-sm font-mono font-bold text-indigo-800">{externalId}</span>
        )}
      </div>
      <button onClick={onClear}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
        <X size={14} /> Clear filter
      </button>
    </div>
  )
}

export default function DocumentsPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [mode, setMode] = useState('browse') // 'browse' | 'search'
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()

  const customerFilter = searchParams.get('customer') || ''

  const handleUploadComplete = () => {
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  const handleToggleSearch = () => {
    setMode(m => m === 'search' ? 'browse' : 'search')
    if (mode !== 'search') setShowUpload(false)
  }

  const handleClearCustomer = () => {
    searchParams.delete('customer')
    setSearchParams(searchParams)
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

      {/* ── Customer filter banner ──────────────────────────── */}
      {customerFilter && (
        <CustomerFilterBanner externalId={customerFilter} onClear={handleClearCustomer} />
      )}

      {/* ── Search mode ───────────────────────────────────────── */}
      {mode === 'search' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ minHeight: '60vh' }}>
          <DocumentSearchPanel onClose={() => setMode('browse')} />
        </div>
      )}

      {/* ── Browse mode ───────────────────────────────────────── */}
      {mode === 'browse' && (
        <>
          {showUpload && (
            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Upload Documents</h2>
                <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close upload panel">
                  <X size={16} />
                </button>
              </div>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>
          )}

          <ErrorBoundary>
            <DocumentTable customerFilter={customerFilter} />
          </ErrorBoundary>
        </>
      )}

    </div>
  )
}
