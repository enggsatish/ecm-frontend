import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, SlidersHorizontal, ChevronDown, FileText, Loader2 } from 'lucide-react'
import { useDocumentSearch, useSearchSuggestions } from '../../hooks/useSearch'
import { useCategories } from '../../hooks/useAdmin'
import { downloadDocument } from '../../api/documentsApi'
import toast from 'react-hot-toast'

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Facet chip ────────────────────────────────────────────────────────────────

function FacetChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
        }`}>{count}</span>
      )}
    </button>
  )
}

// ── Highlighted snippet ───────────────────────────────────────────────────────

function Snippet({ html }) {
  if (!html) return null
  return (
    <p className="text-xs text-gray-500 mt-1 line-clamp-2"
      dangerouslySetInnerHTML={{
        // Strip <mark> tags and apply Tailwind highlight via replace
        __html: html.replace(/<mark>/g, '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">')
      }}
    />
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function DocumentSearchPanel({ onClose }) {
  const [rawQ,       setRawQ]       = useState('')
  const [page,       setPage]       = useState(0)
  const [showSuggest, setShowSuggest] = useState(false)

  // Active facet filters
  const [activeCategories, setActiveCategories] = useState([])
  const [activeStatuses,   setActiveStatuses]   = useState([])
  const [activeMimes,      setActiveMimes]       = useState([])

  const inputRef = useRef(null)
  const debouncedQ = useDebounce(rawQ, 300)

  const { data: categories = [] } = useCategories()

  const searchParams = {
    q:          debouncedQ || undefined,
    categoryId: activeCategories.length ? activeCategories : undefined,
    status:     activeStatuses.length   ? activeStatuses   : undefined,
    mimeType:   activeMimes.length      ? activeMimes       : undefined,
    page, size: 20, highlight: true,
  }

  const { data, isFetching, isLoading } = useDocumentSearch(searchParams)
  const { data: suggestions = [] }      = useSearchSuggestions(debouncedQ)

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Reset page on filter/query change
  useEffect(() => { setPage(0) }, [debouncedQ, activeCategories, activeStatuses, activeMimes])

  const toggleFilter = useCallback((arr, setArr, val) => {
    setArr(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }, [])

  const clearAll = () => {
    setRawQ('')
    setActiveCategories([])
    setActiveStatuses([])
    setActiveMimes([])
    setPage(0)
    inputRef.current?.focus()
  }

  const handleDownload = async (hit) => {
    try {
      await downloadDocument(hit.documentId, hit.documentName)
    } catch {
      toast.error('Download failed')
    }
  }

  const hasActiveFilters = activeCategories.length || activeStatuses.length || activeMimes.length

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-100">
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={rawQ}
            onChange={(e) => { setRawQ(e.target.value); setShowSuggest(true) }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder="Search documents, extracted content, fields..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200
                       text-sm text-gray-800 placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                       transition-shadow"
          />
          {rawQ && (
            <button onClick={() => setRawQ('')}
              className="absolute right-3 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}

          {/* Type-ahead dropdown */}
          {showSuggest && suggestions.length > 0 && rawQ.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border
                            border-gray-200 shadow-lg z-50 overflow-hidden">
              {suggestions.map((s, i) => (
                <button key={i} onMouseDown={() => { setRawQ(s); setShowSuggest(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700
                             hover:bg-gray-50 flex items-center gap-2">
                  <Search size={13} className="text-gray-400 flex-shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results count + clear */}
        <div className="flex items-center justify-between mt-2 h-5">
          {data && (
            <span className="text-xs text-gray-400">
              {data.totalHits.toLocaleString()} result{data.totalHits !== 1 ? 's' : ''}
              {(isFetching && !isLoading) && ' · refreshing…'}
            </span>
          )}
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Facet filters ────────────────────────────────────────────── */}
      {data?.facets && (
        <div className="px-6 py-3 border-b border-gray-100 space-y-2.5">
          {/* Status facets */}
          {data.facets.status?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400 uppercase w-14 flex-shrink-0">Status</span>
              {data.facets.status.map(f => (
                <FacetChip key={f.key} label={f.key} count={f.docCount}
                  active={activeStatuses.includes(f.key)}
                  onClick={() => toggleFilter(activeStatuses, setActiveStatuses, f.key)} />
              ))}
            </div>
          )}

          {/* Category facets — show category name from admin data */}
          {data.facets.category?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400 uppercase w-14 flex-shrink-0">Category</span>
              {data.facets.category.slice(0, 8).map(f => {
                const cat = categories.find(c => c.code === f.key)
                const catId = cat?.id
                return (
                  <FacetChip key={f.key} label={cat?.name ?? f.key} count={f.docCount}
                    active={catId && activeCategories.includes(catId)}
                    onClick={() => catId && toggleFilter(activeCategories, setActiveCategories, catId)} />
                )
              })}
            </div>
          )}

          {/* MIME type facets */}
          {data.facets.mime?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400 uppercase w-14 flex-shrink-0">Type</span>
              {data.facets.mime.map(f => {
                const label = f.key === 'application/pdf' ? 'PDF'
                  : f.key.startsWith('image/') ? 'Image'
                  : f.key.includes('officedocument') ? 'Office'
                  : f.key
                return (
                  <FacetChip key={f.key} label={label} count={f.docCount}
                    active={activeMimes.includes(f.key)}
                    onClick={() => toggleFilter(activeMimes, setActiveMimes, f.key)} />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Results list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Searching...
          </div>
        )}

        {!isLoading && data?.hits?.length === 0 && (debouncedQ || hasActiveFilters) && (
          <div className="text-center py-12">
            <FileText size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No documents found</p>
            <p className="text-xs text-gray-400 mt-1">Try different keywords or remove some filters</p>
          </div>
        )}

        {!isLoading && !debouncedQ && !hasActiveFilters && !data && (
          <div className="text-center py-12">
            <Search size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Search your documents</p>
            <p className="text-xs text-gray-400 mt-1">Search by name, content, or extracted data fields</p>
          </div>
        )}

        {data?.hits?.map((hit) => (
          <div key={hit.documentId}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-100
                       hover:border-blue-200 hover:bg-blue-50/30 transition-colors group">

            {/* Icon */}
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
              <FileText size={16} className="text-gray-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate"
                dangerouslySetInnerHTML={{
                  __html: hit.highlightedName?.replace(/<mark>/g,
                    '<mark class="bg-yellow-100 text-yellow-800 rounded px-0.5">') ?? hit.documentName
                }}
              />
              <div className="flex items-center gap-2 mt-0.5">
                {hit.categoryCode && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    {hit.categoryCode}
                  </span>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  hit.status === 'ACTIVE'   ? 'bg-emerald-50 text-emerald-600' :
                  hit.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-500' :
                                              'bg-amber-50 text-amber-600'
                }`}>{hit.status}</span>
                {hit.uploadedAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(hit.uploadedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Snippet html={hit.highlightedSnippet} />

              {/* Extracted fields preview */}
              {hit.extractedFields && Object.keys(hit.extractedFields).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {Object.entries(hit.extractedFields).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="text-[10px] text-gray-500">
                      <span className="font-medium text-gray-700">{k.replace(/_/g, ' ')}: </span>
                      {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Download action */}
            <button
              onClick={() => handleDownload(hit)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
                         text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1
                         rounded-lg hover:bg-blue-50"
            >
              Download
            </button>
          </div>
        ))}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <button disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200
                       hover:bg-gray-50 disabled:opacity-40 transition-colors">
            Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} of {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200
                       hover:bg-gray-50 disabled:opacity-40 transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  )
}