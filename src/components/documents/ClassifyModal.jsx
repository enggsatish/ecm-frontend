/**
 * ClassifyModal.jsx
 * Shared modal for classifying documents — used from both Document table
 * and Batch detail page. Cascading hierarchy: Customer → Segment → Product Line → Category.
 */
import { useState } from 'react'
import { X, Tag, Search, Loader2, CheckCircle, ChevronDown } from 'lucide-react'
import { useHierarchy, useCategories, usePartySearch } from '../../hooks/useAdmin'

export default function ClassifyModal({ documentName, initialCategoryId, initialCustomerRef, onSubmit, onCancel, isPending }) {
  const [segmentId, setSegmentId] = useState('')
  const [productLineId, setProductLineId] = useState('')
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerRef, setCustomerRef] = useState(initialCustomerRef ?? '')
  const [customerId, setCustomerId] = useState('')
  const [customerLabel, setCustomerLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [showResults, setShowResults] = useState(false)

  const { data: hierarchy = [] } = useHierarchy()
  const { data: allCategories = [] } = useCategories(true)
  const { data: customerResults } = usePartySearch(customerSearch, 8)

  // Derived product lines for selected segment
  const selectedSegment = hierarchy.find(n => String(n.segmentId) === String(segmentId))
  const productLines = selectedSegment?.productLines ?? []

  // Filter categories by product line
  const filteredCategories = productLineId
    ? allCategories.filter(c => !c.productLineId || String(c.productLineId) === String(productLineId))
    : allCategories

  const customers = Array.isArray(customerResults?.content)
    ? customerResults.content
    : Array.isArray(customerResults) ? customerResults : []

  const handleSegmentChange = (val) => {
    setSegmentId(val)
    setProductLineId('')
    setCategoryId('')
  }

  const handleProductLineChange = (val) => {
    setProductLineId(val)
    setCategoryId('')
  }

  const handleSubmit = () => {
    onSubmit({
      categoryId: categoryId ? Number(categoryId) : null,
      segmentId: segmentId ? Number(segmentId) : null,
      productLineId: productLineId ? Number(productLineId) : null,
      partyExternalId: customerRef || null,
      finalCustomerId: customerId || null,
      reviewNotes: notes || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
         onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Classify Document</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Document name */}
        {documentName && (
          <div className="px-6 pt-4">
            <p className="text-sm text-gray-500 truncate" title={documentName}>{documentName}</p>
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 space-y-4">

          {/* Customer search */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={customerLabel || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setCustomerLabel('')
                  setCustomerId('')
                  setCustomerRef('')
                  setShowResults(true)
                }}
                onFocus={() => customerSearch.length >= 2 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder="Search by name or account..."
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
              {customerLabel && (
                <button
                  onClick={() => { setCustomerLabel(''); setCustomerId(''); setCustomerRef(''); setCustomerSearch('') }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {showResults && customers.length > 0 && !customerLabel && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-gray-200
                              bg-white shadow-lg max-h-48 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerRef(c.customerRef ?? '')
                      setCustomerLabel(c.displayName ?? c.shortName ?? c.customerRef ?? '')
                      setCustomerSearch('')
                      setShowResults(false)
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium">{c.displayName ?? c.shortName ?? ''}</span>
                    {c.customerRef && <span className="ml-2 text-xs text-gray-400">{c.customerRef}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Segment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Segment</label>
            <div className="relative">
              <select
                value={segmentId}
                onChange={(e) => handleSegmentChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-white
                           pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-200 focus:border-blue-400"
              >
                <option value="">Select segment...</option>
                {hierarchy.map((s) => (
                  <option key={s.segmentId} value={s.segmentId}>{s.segmentName}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Product Line */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product Line</label>
            <div className="relative">
              <select
                value={productLineId}
                onChange={(e) => handleProductLineChange(e.target.value)}
                disabled={!segmentId}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-white
                           pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-200 focus:border-blue-400
                           disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{segmentId ? 'Select product line...' : 'Select segment first'}</option>
                {productLines.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-white
                           pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-200 focus:border-blue-400"
              >
                <option value="">Select category...</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ?? c.code}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional classification notes"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!categoryId || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2
                       text-sm font-medium text-white hover:bg-blue-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Classify
          </button>
        </div>
      </div>
    </div>
  )
}
