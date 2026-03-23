/**
 * CustomerPortfolioPage.jsx
 * Route: /customers/:id/portfolio
 *
 * Complete customer document portfolio — all cases with their documents.
 * Tabs: Active Cases | Completed Cases | All Documents
 */
import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ChevronRight, FolderOpen, FileText, User, Download, Eye,
  Loader2, CheckCircle, Clock, XCircle, Package, Search, Filter,
  ExternalLink, Upload, Plus, X,
} from 'lucide-react'
import { useCustomerPortfolio } from '../../hooks/useAdmin'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'

const STATUS_COLORS = {
  OPEN:              'bg-blue-50 text-blue-700',
  DOCUMENTS_PENDING: 'bg-amber-50 text-amber-700',
  UNDER_REVIEW:      'bg-indigo-50 text-indigo-700',
  PENDING_APPROVAL:  'bg-orange-50 text-orange-700',
  APPROVED:          'bg-green-50 text-green-700',
  COMPLETED:         'bg-green-50 text-green-700',
  REJECTED:          'bg-red-50 text-red-700',
  CANCELLED:         'bg-gray-100 text-gray-500',
  ON_HOLD:           'bg-gray-100 text-gray-600',
}

const DOC_STATUS_COLORS = {
  PENDING:      'bg-gray-100 text-gray-500',
  UPLOADED:     'bg-blue-50 text-blue-600',
  UNDER_REVIEW: 'bg-amber-50 text-amber-600',
  APPROVED:     'bg-green-50 text-green-600',
  REJECTED:     'bg-red-50 text-red-500',
  WAIVED:       'bg-gray-100 text-gray-400',
  VERIFIED:     'bg-green-50 text-green-600',
}

function StatusBadge({ status, small }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${color} ${small ? 'text-[10px]' : 'text-xs'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function CaseCard({ caseData, onViewDocument }) {
  const [expanded, setExpanded] = useState(true)
  const docs = caseData.documents ?? []
  const extUploads = caseData.externalUploads ?? []
  const docCount = docs.filter(d => d.document_id).length + extUploads.length
  const totalItems = docs.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Case header */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={18} className="text-blue-500" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{caseData.productName}</p>
              <StatusBadge status={caseData.status} small />
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
              {caseData.externalRef && <span className="font-mono">{caseData.externalRef}</span>}
              <span>{caseData.caseType?.replace(/_/g, ' ')}</span>
              {caseData.segmentName && <span>{caseData.segmentName} → {caseData.productLineName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{docCount}/{totalItems} docs</span>
          <Link to={`/cases/${caseData.caseId}`} onClick={e => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            Open <ExternalLink size={10} />
          </Link>
          <ChevronRight size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Documents */}
      {expanded && (
        <div className="border-t border-gray-100">
          {docs.length === 0 && extUploads.length === 0 ? (
            <p className="px-5 py-4 text-xs text-gray-400 text-center">No documents</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2 text-left text-gray-500 font-medium">Document</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Type</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Uploaded By</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Size</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.checklist_item_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText size={12} className="text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{doc.document_type_name}</p>
                          {doc.document_name && doc.document_name !== doc.document_type_name && (
                            <p className="text-gray-400 truncate max-w-[200px]">{doc.document_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        doc.source_type === 'EFORM' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'
                      }`}>{doc.source_type}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        DOC_STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-500'
                      }`}>{doc.status}</span>
                      {doc.is_verified && (
                        <CheckCircle size={10} className="inline ml-1 text-green-500" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {doc.uploaded_by ? doc.uploaded_by.split('@')[0] : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-3 py-2.5">
                      {doc.document_id && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => onViewDocument?.(doc.document_id)}
                            className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Preview">
                            <Eye size={12} />
                          </button>
                          <a href={`/api/documents/${doc.document_id}/download`} target="_blank" rel="noreferrer"
                            className="text-gray-400 hover:text-gray-600" title="Download">
                            <Download size={12} />
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* External uploads */}
                {extUploads.map(eu => (
                  <tr key={`ext-${eu.id}`} className="border-b border-gray-50 hover:bg-gray-50/50 bg-purple-50/30">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Upload size={12} className="text-purple-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{eu.original_filename}</p>
                          {eu.description && <p className="text-gray-400 truncate max-w-[200px]">{eu.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">EXTERNAL</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600">UPLOADED</span>
                    </td>
                    <td className="px-3 py-2.5 text-purple-600">
                      {eu.participant_name} ({eu.participant_role})
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {eu.uploaded_at ? new Date(eu.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{formatBytes(eu.file_size_bytes)}</td>
                    <td className="px-3 py-2.5">
                      {eu.document_id && (
                        <a href={`/api/documents/${eu.document_id}/download`} target="_blank" rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700">
                          <Download size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Enrollments Section ──────────────────────────────────────────────────────

const ENROLL_STATUS_COLORS = {
  ACTIVE:    'bg-green-50 text-green-700 border-green-200',
  PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED:  'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
}

function EnrollmentsSection({ customer, onRefresh }) {
  const navigate = useNavigate()
  const enrollments = customer?.enrollments ?? []

  const active = enrollments.filter(e => e.status === 'ACTIVE')
  const pending = enrollments.filter(e => e.status === 'PENDING')
  const past = enrollments.filter(e => e.status === 'REJECTED' || e.status === 'CANCELLED')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Package size={14} className="text-blue-500" />
          Products & Applications
        </h3>
        <button onClick={() => navigate('/cases', { state: { createFor: customer } })}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
          <Plus size={12} /> New Application
        </button>
      </div>

      {enrollments.length === 0 && (
        <p className="text-xs text-gray-400 italic">No products or applications</p>
      )}

      {/* Active Products */}
      {active.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">Active Products</p>
          <div className="flex flex-wrap gap-2">
            {active.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-xs font-medium text-green-900">{e.productName ?? e.productLineName}</span>
                {e.productLineName && e.productName && (
                  <span className="text-[10px] text-green-500">({e.productLineName})</span>
                )}
                <span className="text-[10px] text-green-400">
                  {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Applications */}
      {pending.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">Pending Applications</p>
          <div className="flex flex-wrap gap-2">
            {pending.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                <Clock size={12} className="text-amber-500" />
                <span className="text-xs font-medium text-amber-900">{e.productName ?? e.productLineName}</span>
                {e.caseId && (
                  <Link to={`/cases/${e.caseId}`}
                    className="text-[10px] text-amber-600 hover:text-amber-800 underline cursor-pointer">
                    View Case
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Applications */}
      {past.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">Past Applications</p>
          <div className="flex flex-wrap gap-2">
            {past.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <XCircle size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">{e.productName ?? e.productLineName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ENROLL_STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerPortfolioPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const { data: portfolio, isLoading } = useCustomerPortfolio(id)
  const [tab, setTab] = useState('active')
  const [searchDoc, setSearchDoc] = useState('')
  const [viewingDocId, setViewingDocId] = useState(null)

  const customer = portfolio?.customer
  const cases = portfolio?.cases ?? []
  const uncategorized = portfolio?.uncategorizedDocuments ?? []

  const activeCases = useMemo(() =>
    cases.filter(c => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c.status))
  , [cases])

  const completedCases = useMemo(() =>
    cases.filter(c => ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(c.status))
  , [cases])

  // All documents flat for search
  const allDocs = useMemo(() => {
    const docs = []
    for (const c of cases) {
      for (const d of (c.documents ?? [])) {
        if (d.document_id) {
          docs.push({ ...d, caseName: c.productName, caseRef: c.externalRef, caseStatus: c.status })
        }
      }
      for (const eu of (c.externalUploads ?? [])) {
        docs.push({
          document_name: eu.original_filename,
          document_type_name: 'External Upload',
          uploaded_by: eu.participant_name,
          uploaded_at: eu.uploaded_at,
          file_size_bytes: eu.file_size_bytes,
          document_id: eu.document_id,
          caseName: c.productName,
          caseRef: c.externalRef,
          status: 'UPLOADED',
        })
      }
    }
    return docs
  }, [cases])

  const filteredDocs = useMemo(() => {
    if (!searchDoc) return allDocs
    const q = searchDoc.toLowerCase()
    return allDocs.filter(d =>
      (d.document_name ?? '').toLowerCase().includes(q) ||
      (d.document_type_name ?? '').toLowerCase().includes(q) ||
      (d.caseName ?? '').toLowerCase().includes(q)
    )
  }, [allDocs, searchDoc])

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
    </div>
  )

  const TABS = [
    { key: 'active', label: 'Active Cases', count: activeCases.length },
    { key: 'completed', label: 'Completed Cases', count: completedCases.length },
    { key: 'all-docs', label: 'All Documents', count: allDocs.length },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(navState?.from ?? '/admin/customers')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          <ArrowLeft size={14} /> {navState?.fromLabel ?? 'Customers'}
        </button>
        <ChevronRight size={12} className="text-gray-300" />
        <span className="text-sm font-medium text-gray-800">{customer?.displayName ?? 'Portfolio'}</span>
      </div>

      {/* Customer header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center">
            <User size={24} className="text-indigo-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{customer?.displayName}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="font-mono">{customer?.customerRef}</span>
              <span>{customer?.segment}</span>
              {customer?.registrationNo && <span>Reg: {customer.registrationNo}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
            <p className="text-xs text-gray-400">Total Cases</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{allDocs.length}</p>
            <p className="text-xs text-gray-400">Documents</p>
          </div>
        </div>
      </div>

      {/* Product Enrollments */}
      <EnrollmentsSection customer={customer} onRefresh={() => qc.invalidateQueries({ queryKey: ['admin', 'customer-portfolio', id] })} />

      {/* Tabs */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'all-docs' && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchDoc} onChange={e => setSearchDoc(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === 'active' && (
        <div className="space-y-4">
          {activeCases.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <FolderOpen size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active cases</p>
            </div>
          ) : activeCases.map(c => <CaseCard key={c.caseId} caseData={c} onViewDocument={setViewingDocId} />)}
        </div>
      )}

      {tab === 'completed' && (
        <div className="space-y-4">
          {completedCases.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <CheckCircle size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No completed cases</p>
            </div>
          ) : completedCases.map(c => <CaseCard key={c.caseId} caseData={c} onViewDocument={setViewingDocId} />)}
        </div>
      )}

      {tab === 'all-docs' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{searchDoc ? 'No documents match your search' : 'No documents'}</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-gray-500 font-semibold">Document</th>
                  <th className="px-3 py-3 text-left text-gray-500 font-semibold">Case</th>
                  <th className="px-3 py-3 text-left text-gray-500 font-semibold">Status</th>
                  <th className="px-3 py-3 text-left text-gray-500 font-semibold">Uploaded By</th>
                  <th className="px-3 py-3 text-left text-gray-500 font-semibold">Date</th>
                  <th className="px-3 py-3 text-left text-gray-500 font-semibold">Size</th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-gray-800">{doc.document_type_name}</p>
                      {doc.document_name && <p className="text-gray-400 truncate max-w-[200px]">{doc.document_name}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-gray-700">{doc.caseName}</p>
                      <p className="text-gray-400 font-mono">{doc.caseRef}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        DOC_STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-500'
                      }`}>{doc.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {doc.uploaded_by ? (doc.uploaded_by.includes('@') ? doc.uploaded_by.split('@')[0] : doc.uploaded_by) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-3 py-2.5">
                      {doc.document_id && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setViewingDocId(doc.document_id)}
                            className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Preview">
                            <Eye size={12} />
                          </button>
                          <a href={`/api/documents/${doc.document_id}/download`} target="_blank" rel="noreferrer"
                            className="text-gray-400 hover:text-gray-600" title="Download">
                            <Download size={12} />
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Uncategorized documents */}
          {uncategorized.length > 0 && (
            <div className="border-t border-gray-200">
              <div className="px-5 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500">Uncategorized Documents ({uncategorized.length})</p>
              </div>
              {uncategorized.map(doc => (
                <div key={doc.document_id} className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 hover:bg-gray-50/50">
                  <FileText size={12} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{doc.name ?? doc.original_filename}</p>
                    {doc.category_name && <p className="text-[10px] text-gray-400">{doc.category_name}</p>}
                  </div>
                  <span className="text-[10px] text-gray-400">{doc.uploaded_by_email?.split('@')[0]}</span>
                  <span className="text-[10px] text-gray-400">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</span>
                  <span className="text-[10px] text-gray-400">{formatBytes(doc.file_size_bytes)}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewingDocId(doc.document_id)}
                      className="text-blue-500 hover:text-blue-700 cursor-pointer" title="Preview">
                      <Eye size={12} />
                    </button>
                    <a href={`/api/documents/${doc.document_id}/download`} target="_blank" rel="noreferrer"
                      className="text-gray-400 hover:text-gray-600" title="Download">
                      <Download size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewingDocId && (
        <DocumentViewerModal documentId={viewingDocId} onClose={() => setViewingDocId(null)} previewOnly />
      )}
    </div>
  )
}
