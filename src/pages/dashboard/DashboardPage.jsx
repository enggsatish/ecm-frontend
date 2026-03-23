import { useState } from 'react'
import { FileText, CheckSquare, Clock, TrendingUp, Loader2, ArrowRight, Search, User, X, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { FileText as FileTextIcon, Briefcase, FolderOpen } from 'lucide-react'
import { listDocuments } from '../../api/documentsApi'
import { listCustomers, listCases } from '../../api/adminApi'
import { getMyTasks } from '../../api/workflowApi'
import ErrorBoundary from '../../components/common/ErrorBoundary'

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                    p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {loading
              ? <Loader2 className="w-6 h-6 animate-spin text-gray-200 mt-1" />
              : value}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                         ${accent === 'green'  ? 'bg-accent-50'    : ''}
                         ${accent === 'navy'   ? 'bg-primary-50'   : ''}
                         ${accent === 'amber'  ? 'bg-amber-50'     : ''}
                         ${accent === 'purple' ? 'bg-purple-50'    : ''}`}>
          <Icon className={`w-5 h-5
            ${accent === 'green'  ? 'text-accent-600'  : ''}
            ${accent === 'navy'   ? 'text-primary-600' : ''}
            ${accent === 'amber'  ? 'text-amber-600'   : ''}
            ${accent === 'purple' ? 'text-purple-600'  : ''}`} />
        </div>
      </div>
      <div className={`mt-4 h-0.5 rounded-full w-12
        ${accent === 'green'  ? 'bg-accent-400'  : ''}
        ${accent === 'navy'   ? 'bg-primary-400' : ''}
        ${accent === 'amber'  ? 'bg-amber-400'   : ''}
        ${accent === 'purple' ? 'bg-purple-400'  : ''}`} />
    </div>
  )
}

// ── Document type badge ────────────────────────────────────────────────────────
function DocTypeBadge({ mime }) {
  const m = mime ?? ''
  if (m.includes('pdf'))    return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-600 bg-red-50">PDF</span>
  if (m.includes('word') || m.includes('document')) return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 bg-blue-50">DOCX</span>
  if (m.includes('sheet') || m.includes('excel'))   return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 bg-emerald-50">XLSX</span>
  if (m.startsWith('image/')) return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-600 bg-purple-50">IMG</span>
  return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gray-500 bg-gray-100">FILE</span>
}

// ── Document row ──────────────────────────────────────────────────────────────
function DocRow({ doc }) {
  const date = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '—'
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-50
                    hover:bg-gray-50/80 transition-colors group">
      <DocTypeBadge mime={doc.mimeType} />
      <span className="flex-1 text-sm text-gray-700 truncate font-medium">
        {doc.name ?? doc.originalFilename ?? '—'}
      </span>
      {doc.partyExternalId && (
        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {doc.partyExternalId}
        </span>
      )}
      {doc.status === 'PENDING_OCR' && (
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Processing</span>
      )}
      <span className="text-xs text-gray-400 whitespace-nowrap">{date}</span>
    </div>
  )
}

// ── Recent Cases ─────────────────────────────────────────────────────────────
const CASE_STATUS_COLORS = {
  OPEN:               'bg-blue-50 text-blue-600',
  DOCUMENTS_PENDING:  'bg-amber-50 text-amber-600',
  UNDER_REVIEW:       'bg-indigo-50 text-indigo-600',
  APPROVED:           'bg-green-50 text-green-600',
  COMPLETED:          'bg-green-50 text-green-600',
  REJECTED:           'bg-red-50 text-red-500',
  CANCELLED:          'bg-gray-100 text-gray-400',
}

function RecentCases() {
  const { data: cases = [] } = useQuery({
    queryKey: ['admin', 'cases', { recent: true }],
    queryFn: () => listCases({ size: 5 }),
    staleTime: 30_000,
  })

  const caseList = (Array.isArray(cases) ? cases : []).slice(0, 5)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-purple-500" />
          <h3 className="font-bold text-gray-900 text-sm">Recent Cases</h3>
        </div>
        <Link to="/cases" className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-semibold">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {caseList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <Briefcase className="w-8 h-8 text-gray-200 mb-2" />
          <p className="text-sm font-medium text-gray-500">No cases yet</p>
          <Link to="/cases" className="mt-2 text-xs text-purple-600 font-semibold hover:underline">
            Create a case
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {caseList.map(c => (
            <Link key={c.id} to="/cases"
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
              <Briefcase className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 font-medium truncate">
                  {c.partyDisplayName ?? 'Unknown'} — {c.productName ?? 'No product'}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                CASE_STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'
              }`}>{c.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main dashboard content ───────────────────────────────────────────────────
function DashboardContent() {
  const navigate = useNavigate()
  const [custQuery, setCustQuery] = useState('')
  const [selectedParty, setSelectedParty] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Recent documents (default view)
  const { data, isLoading } = useQuery({
    queryKey: ['documents', { page: 0, size: 10, sort: 'createdAt,desc' }],
    queryFn:  () => listDocuments({ page: 0, size: 10, sort: 'createdAt,desc' }),
    staleTime: 60_000,
    throwOnError: false,
  })

  // Customer search
  const { data: customers, isLoading: searching } = useQuery({
    queryKey: ['customers-search', custQuery],
    queryFn:  () => listCustomers({ q: custQuery, size: 8 }),
    enabled:  custQuery.length >= 2 && !selectedParty,
    staleTime: 30_000,
  })

  // Customer's documents (when selected)
  const { data: partyDocs, isLoading: loadingPartyDocs } = useQuery({
    queryKey: ['documents', 'party', selectedParty?.externalId ?? selectedParty?.customerRef],
    queryFn:  () => listDocuments({ partyExternalId: selectedParty.externalId ?? selectedParty.customerRef, size: 20 }),
    enabled:  !!(selectedParty?.externalId || selectedParty?.customerRef),
  })

  const total = data?.totalElements ?? 0
  const recentDocs = data?.content ?? []
  const pendingCount = recentDocs.filter(d => d.status === 'PENDING_OCR').length
  const customerList = Array.isArray(customers) ? customers : (customers?.content ?? [])
  const partyDocList = partyDocs?.content ?? []

  const handleSelectCustomer = (c) => {
    setSelectedParty(c)
    setCustQuery(c.displayName)
    setShowDropdown(false)
  }

  const handleClearCustomer = () => {
    setSelectedParty(null)
    setCustQuery('')
  }

  const handleViewAllCustomerDocs = () => {
    const ref = selectedParty?.externalId ?? selectedParty?.customerRef
    if (ref) navigate(`/documents?customer=${encodeURIComponent(ref)}`)
  }

  // Which documents to show in the panel
  const showingCustomerDocs = !!selectedParty
  const displayDocs = showingCustomerDocs ? partyDocList : recentDocs
  const docsLoading = showingCustomerDocs ? loadingPartyDocs : isLoading

  return (
    <>
      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}    label="Total Documents" value={total}              accent="navy"   loading={isLoading} />
        <StatCard icon={Clock}       label="Pending OCR"     value={pendingCount}       accent="amber"  loading={isLoading} />
        <StatCard icon={CheckSquare} label="Recent Uploads"  value={recentDocs.length}  accent="green"  loading={isLoading} />
        <StatCard icon={TrendingUp}  label="Forms Submitted" value="—"                  accent="purple" loading={false} />
      </div>

      {/* ── Content grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Documents panel (left, 2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header with customer search */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-5 rounded-full bg-accent-500" />
                <h3 className="font-bold text-gray-900 text-sm">
                  {showingCustomerDocs ? 'Customer Documents' : 'Recent Documents'}
                </h3>
              </div>
              {showingCustomerDocs ? (
                <button onClick={handleViewAllCustomerDocs}
                  className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-semibold">
                  View all in Documents <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Link to="/documents" className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-semibold">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Customer search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={custQuery}
                onChange={e => { setCustQuery(e.target.value); setShowDropdown(true); if (!e.target.value) setSelectedParty(null); }}
                onFocus={() => custQuery.length >= 2 && !selectedParty && setShowDropdown(true)}
                placeholder="Search customer by name or ID to filter documents..."
                className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
              {(custQuery || selectedParty) && (
                <button onClick={handleClearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Customer dropdown */}
              {showDropdown && custQuery.length >= 2 && !selectedParty && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {searching ? (
                    <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Searching...</div>
                  ) : customerList.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400">No customers found</div>
                  ) : customerList.map(c => (
                    <button key={c.id} onClick={() => handleSelectCustomer(c)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.displayName}</p>
                        <p className="text-xs text-gray-400">{c.externalId ?? c.customerRef} &middot; {c.partyType ?? c.segment}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected customer chip — name links to portfolio */}
            {selectedParty && (
              <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <User className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <button onClick={() => navigate(`/customers/${selectedParty.id}/portfolio`, { state: { from: '/', fromLabel: 'Dashboard' } })}
                  className="text-xs font-semibold text-indigo-900 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer">
                  {selectedParty.displayName}
                  <ExternalLink className="w-3 h-3 text-indigo-400" />
                </button>
                <span className="text-xs text-indigo-500">{selectedParty.externalId ?? selectedParty.customerRef}</span>
                <span className="ml-auto text-xs font-medium text-indigo-600">{partyDocList.length} doc{partyDocList.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Document list */}
          {docsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
            </div>
          ) : displayDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">
                {showingCustomerDocs ? 'No documents for this customer' : 'No documents yet'}
              </p>
              {!showingCustomerDocs && (
                <Link to="/documents" className="mt-4 text-xs text-accent-600 font-semibold hover:underline">
                  Go to Documents
                </Link>
              )}
            </div>
          ) : (
            displayDocs.map(doc => <DocRow key={doc.id} doc={doc} />)
          )}
        </div>

        {/* Right column — Cases + My Tasks */}
        <div className="flex flex-col gap-5">

          {/* Recent Cases */}
          <RecentCases />

          {/* My Tasks — fetches claimed tasks from Review Queue */}
          <MyTasksWidget />
        </div>
      </div>
    </>
  )
}

// ── My Tasks Widget ──────────────────────────────────────────────────────────
function MyTasksWidget() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks-dashboard'],
    queryFn: getMyTasks,
    refetchInterval: 30_000,
    throwOnError: false,
  })

  const taskList = Array.isArray(tasks) ? tasks : (tasks?.content ?? [])

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-primary-600" />
          <h3 className="font-bold text-gray-900 text-sm">My Tasks</h3>
          {taskList.length > 0 && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {taskList.length}
            </span>
          )}
        </div>
        <Link to="/backoffice/queue" className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold">
          Review Queue <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : taskList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <CheckSquare className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">All clear</p>
          <p className="text-xs text-gray-400 mt-1">No tasks assigned to you</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {taskList.slice(0, 5).map(task => (
            <Link key={task.taskId ?? task.id} to="/backoffice/queue"
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {task.taskName ?? task.name ?? 'Task'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {task.documentName ?? task.formKey ?? ''}
                </p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
          {taskList.length > 5 && (
            <div className="px-5 py-2.5 text-center">
              <Link to="/backoffice/queue" className="text-xs text-primary-600 font-medium">
                +{taskList.length - 5} more tasks
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Customer Search Widget ──────────────────────────────────────────────────
function CustomerSearchWidget() {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const navigate = useNavigate()

  const { data: customers } = useQuery({
    queryKey: ['dashboard-customer-search', query],
    queryFn: () => listCustomers({ q: query, size: 6 }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  const results = Array.isArray(customers) ? customers : (customers?.content ?? [])

  const handleSelect = (customer) => {
    setQuery('')
    setShowResults(false)
    navigate(`/customers/${customer.id}/portfolio`, { state: { from: '/', fromLabel: 'Dashboard' } })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
        <h3 className="font-bold text-gray-900 text-sm">Customer Portfolio</h3>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => { if (query.length >= 2) setShowResults(true) }}
          placeholder="Search customer by name or ID..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        {showResults && query.length >= 2 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowResults(false)} />
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">No customers found</p>
              ) : (
                results.map(c => (
                  <button key={c.id} onClick={() => handleSelect(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 text-left border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.displayName}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.customerRef}</p>
                    </div>
                    <span className="text-[10px] text-gray-400">{c.segment}</span>
                    <ArrowRight size={12} className="text-gray-300" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Search to view customer document portfolio, cases, and history</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <ErrorBoundary>
        <DashboardContent />
      </ErrorBoundary>
    </div>
  )
}
