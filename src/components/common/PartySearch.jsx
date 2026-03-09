/**
 * PartySearch.jsx
 * Shared widget — reusable party/customer search with type-ahead or explicit-trigger modes.
 *
 * Usage:
 *   import PartySearch from '../common/PartySearch'
 *
 *   <PartySearch
 *     value={selectedParty}       // PartyDto object | null
 *     onChange={setSelectedParty} // (PartyDto | null) => void
 *     size="default"              // "default" (FormFillPage) | "compact" (DocumentUpload)
 *     autoSearch={false}          // false = Search button + Enter  |  true = keystroke trigger
 *     maxResults={20}             // how many results to request
 *     showHint={true}             // show "Optional — links to a customer" hint below input
 *     placeholder="Search…"
 *   />
 *
 * Value shape (PartyDto from GET /api/admin/customers):
 *   { id, externalId, displayName, partyType, email?, ... }
 *
 * The widget is VALUE-AGNOSTIC — it always calls onChange(fullPartyObject).
 * The caller decides which field to extract:
 *   DocumentUpload  →  selectedParty?.externalId   (DocumentUploadRequest.partyExternalId)
 *   FormFillPage    →  selectedParty?.id            (FormSubmissionRequest.partyId)
 *
 * Sizes:
 *   "default"  — full-width input, larger result rows, used inside a card/page section
 *   "compact"  — smaller input, tighter result rows, used inside a collapsible panel
 *
 * Search trigger:
 *   autoSearch=false  — user clicks [Search] or presses Enter.
 *                       Explicit trigger is better for a dedicated step (FormFillPage)
 *                       because it avoids firing mid-keystroke.
 *   autoSearch=true   — fetches as the user types (≥ 2 chars, 300 ms debounce).
 *                       Better for compact inline usage (DocumentUpload).
 *
 * Data:
 *   Uses usePartySearch(query) from hooks/useAdmin — backed by
 *   GET /api/admin/customers?q=<query>&size=<maxResults>
 *   Results are cached by TanStack Query (staleTime: 30 s).
 */
import { useState, useEffect, useRef } from 'react'
import { Search, X, Building2, Loader2, CheckCircle2 } from 'lucide-react'
import { usePartySearch } from '../../hooks/useAdmin'

// ─── Party type colour map ────────────────────────────────────────────────────
const TYPE_STYLES = {
  COMMERCIAL: { avatar: 'bg-blue-100 text-blue-600',   badge: 'bg-blue-50 text-blue-600 border-blue-200'   },
  SMB:        { avatar: 'bg-purple-100 text-purple-600', badge: 'bg-purple-50 text-purple-600 border-purple-200' },
  RETAIL:     { avatar: 'bg-gray-100 text-gray-600',   badge: 'bg-gray-50 text-gray-500 border-gray-200'   },
}
const typeStyle = (type) => TYPE_STYLES[type] ?? TYPE_STYLES.RETAIL

// ─── Selected chip ────────────────────────────────────────────────────────────
// Shown once a party is chosen, replaces the input.

function SelectedChip({ party, onClear, size }) {
  const ts = typeStyle(party.partyType)
  const isCompact = size === 'compact'
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border ${
      isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
    } bg-blue-50 border-blue-200`}>
      <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${ts.avatar} ${
        isCompact ? 'w-6 h-6' : 'w-8 h-8'
      }`}>
        <Building2 size={isCompact ? 11 : 14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-blue-800 truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {party.displayName}
        </p>
        <p className={`text-blue-500 font-mono ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
          {party.externalId}
          {party.partyType && (
            <span className={`ml-1.5 not-italic font-sans inline-flex items-center rounded border px-1 py-0.5 text-[10px] ${ts.badge}`}>
              {party.partyType}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="flex-shrink-0 text-blue-400 hover:text-blue-700 transition-colors"
        aria-label="Remove party"
      >
        <X size={isCompact ? 13 : 15} />
      </button>
    </div>
  )
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({ party, isSelected, onSelect, size }) {
  const ts = typeStyle(party.partyType)
  const isCompact = size === 'compact'
  return (
    <button
      type="button"
      // onMouseDown fires before onBlur — ensures click registers before dropdown hides
      onMouseDown={() => onSelect(party)}
      className={`w-full flex items-center gap-2.5 text-left transition-colors
        border-b border-gray-50 last:border-0
        ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}
        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
    >
      <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${ts.avatar} ${
        isCompact ? 'w-6 h-6' : 'w-9 h-9'
      }`}>
        <Building2 size={isCompact ? 11 : 16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-gray-800 truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {party.displayName}
        </p>
        <p className={`text-gray-400 flex items-center gap-1.5 mt-0.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
          <span className="font-mono">{party.externalId}</span>
          <span>·</span>
          <span>{party.partyType}</span>
          {!isCompact && party.email && (
            <><span>·</span><span className="truncate">{party.email}</span></>
          )}
        </p>
      </div>
      {isSelected && <CheckCircle2 size={isCompact ? 13 : 16} className="text-blue-500 flex-shrink-0" />}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PartySearch({
  value        = null,
  onChange,
  size         = 'default',
  autoSearch   = false,
  maxResults   = 10,
  showHint     = true,
  placeholder  = 'Search by name, ID or email…',
}) {
  const [inputText,    setInputText]    = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')   // committed query that fires fetch
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef                     = useRef(null)

  const { data: results = [], isFetching } = usePartySearch(searchQuery, maxResults)

  // autoSearch: debounce 300 ms so we don't fire on every keystroke
  useEffect(() => {
    if (!autoSearch) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(inputText.trim())
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [inputText, autoSearch])

  // If a value is pre-loaded (e.g. loading a draft), don't show the input
  if (value) {
    return (
      <SelectedChip
        party={value}
        onClear={() => onChange(null)}
        size={size}
      />
    )
  }

  const isCompact = size === 'compact'

  const handleSelect = (party) => {
    onChange(party)
    setInputText('')
    setSearchQuery('')
    setShowDropdown(false)
  }

  // Explicit-trigger (autoSearch=false): Search button or Enter
  const commitSearch = () => {
    const trimmed = inputText.trim()
    if (trimmed.length >= 2) {
      setSearchQuery(trimmed)
      setShowDropdown(true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (autoSearch) return   // already handled reactively
      commitSearch()
    }
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputText(val)
    if (autoSearch) {
      setShowDropdown(val.trim().length >= 2)
    }
    // If user clears the input entirely, reset the committed query
    if (!val.trim()) {
      setSearchQuery('')
      setShowDropdown(false)
    }
  }

  const showResults = showDropdown && searchQuery.length >= 2

  return (
    <div className="space-y-2">
      {/* ── Input row ─────────────────────────────────────────────────── */}
      <div className={`flex gap-2 ${isCompact ? 'items-center' : ''}`}>
        <div className="relative flex-1">
          <Search
            size={isCompact ? 12 : 15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchQuery.length >= 2) setShowDropdown(true)
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={placeholder}
            className={`w-full rounded-lg border border-gray-200 bg-white
                        focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200
                        ${isCompact
                          ? 'pl-7 pr-7 py-1.5 text-xs'
                          : 'pl-9 pr-9 py-2 text-sm'}`}
          />
          {isFetching && (
            <Loader2
              size={isCompact ? 11 : 14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
            />
          )}
        </div>

        {/* Search button — only rendered in explicit mode */}
        {!autoSearch && (
          <button
            type="button"
            onClick={commitSearch}
            disabled={inputText.trim().length < 2}
            className={`rounded-lg bg-blue-600 font-medium text-white
                        hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors flex-shrink-0
                        ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
          >
            Search
          </button>
        )}
      </div>

      {/* ── Results dropdown ───────────────────────────────────────────── */}
      {showResults && (
        <div className="relative">
          <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg
                          max-h-56 overflow-y-auto">
            {isFetching && results.length === 0 ? (
              <div className={`flex items-center gap-2 text-gray-400 ${isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}>
                <Loader2 size={13} className="animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className={`text-gray-400 ${isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}>
                No parties found for "{searchQuery}"
              </div>
            ) : (
              results.map((party) => (
                <ResultRow
                  key={party.id ?? party.externalId}
                  party={party}
                  isSelected={value?.id === party.id}
                  onSelect={handleSelect}
                  size={size}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Hint text ─────────────────────────────────────────────────── */}
      {showHint && !inputText && !showResults && (
        <p className="text-[11px] text-gray-400">
          Optional — links this record to a customer.
        </p>
      )}
    </div>
  )
}