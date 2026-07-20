/**
 * CustomerDetailPage.jsx
 * Route: /customers/:id
 *
 * "Customer 360" — the entry point for CRM-aware form fill (design note
 * "CRM-Aware Form Fill & Customer 360", 2026-07-17). Customer profile
 * (base + live Salesforce) → their cases (Loan Origination / Account
 * Opening only — reviews and other case types aren't "accounts") → each
 * case's document checklist, grouped by category → Fill Form / View
 * Document, reusing the exact same ChecklistItemRow the Cases module uses.
 */
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, Building2, Briefcase, Loader2, RefreshCw, AlertCircle,
  ChevronDown, ChevronRight, Edit2, Check, X, FileText, CheckCircle2, Landmark,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getCustomer, getCustomerCrmProfile, setCustomerCrmProfileValue,
  listCases, getCaseChecklistGrouped,
} from '../../api/adminApi'
import { ChecklistItemRow } from '../cases/CasesPage'
import DocumentViewerModal from '../../components/documents/DocumentViewerModal'
import useUserStore from '../../store/userStore'

const SEGMENT_ICONS = { RETAIL: User, SMB: Briefcase, COMMERCIAL: Building2 }
const SEGMENT_COLORS = {
  RETAIL:     'text-blue-600 bg-blue-50 border-blue-200',
  SMB:        'text-purple-600 bg-purple-50 border-purple-200',
  COMMERCIAL: 'text-amber-600 bg-amber-50 border-amber-200',
}

const CASE_TYPE_LABELS = { LOAN_ORIGINATION: 'Loan Origination', ACCOUNT_OPENING: 'Account Opening' }

function SegmentBadge({ segment }) {
  const Icon = SEGMENT_ICONS[segment] ?? User
  const cls = SEGMENT_COLORS[segment] ?? SEGMENT_COLORS.RETAIL
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon size={11} /> {segment}
    </span>
  )
}

// ── One profile attribute row, editable inline if MANUAL ────────────────────
function ProfileAttributeRow({ attr, customerId }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(attr.value ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await setCustomerCrmProfileValue(customerId, attr.key, value)
      toast.success(`${attr.label} updated`)
      qc.invalidateQueries({ queryKey: ['admin', 'customers', customerId, 'crm-profile'] })
      setEditing(false)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-500 w-36 flex-shrink-0">{attr.label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5 flex-1">
          <input value={value} onChange={e => setValue(e.target.value)} autoFocus
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700 p-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button onClick={() => { setEditing(false); setValue(attr.value ?? '') }} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-gray-800">{attr.value ?? <span className="text-gray-300">—</span>}</span>
          {attr.source === 'MANUAL' && (
            <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-600"><Edit2 size={12} /></button>
          )}
          {attr.source === 'CRM_MAPPED' && (
            <span className="text-[9px] font-semibold text-blue-400 uppercase">CRM</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── One Tier B relationship type, rendered as a small table ─────────────────
function RelationshipSection({ relationship }) {
  const columns = relationship.records.length > 0 ? Object.keys(relationship.records[0]) : []
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Landmark size={12} /> {relationship.typeName}
      </h3>
      {relationship.records.length === 0 ? (
        <p className="text-xs text-gray-400 pb-1">None found in Salesforce.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                {columns.map(c => <th key={c} className="font-medium pr-4 pb-1">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {relationship.records.map((r, i) => (
                <tr key={i} className="border-t border-gray-50">
                  {columns.map(c => <td key={c} className="py-1.5 pr-4 text-gray-700">{r[c] ?? <span className="text-gray-300">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Profile section (base fields + live/manual CRM profile) ─────────────────
function ProfileSection({ customer, customerId }) {
  const { data: crmProfile, isLoading, isError } = useQuery({
    queryKey: ['admin', 'customers', customerId, 'crm-profile'],
    queryFn: () => getCustomerCrmProfile(customerId),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        <SegmentBadge segment={customer.segment} />
      </div>

      <div className="grid grid-cols-2 gap-x-8 mb-4">
        <div className="flex gap-2 text-sm py-1"><span className="text-gray-400 w-28">Customer Ref</span><span className="font-mono text-gray-700">{customer.customerRef}</span></div>
        <div className="flex gap-2 text-sm py-1"><span className="text-gray-400 w-28">Display Name</span><span className="text-gray-800">{customer.displayName}</span></div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-4 text-gray-400"><Loader2 size={16} className="animate-spin" /></div>
        ) : isError ? (
          <p className="text-xs text-gray-400 py-2">Could not load profile.</p>
        ) : (
          <>
            {!crmProfile.salesforceAvailable && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
                <AlertCircle size={12} />
                Salesforce unavailable{crmProfile.salesforceError ? ` — ${crmProfile.salesforceError}` : ''}. CRM-mapped fields show as unavailable below.
              </div>
            )}
            {crmProfile.salesforceAvailable && crmProfile.crmMatched === false && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
                <AlertCircle size={12} />
                Not found in Salesforce — no record matches reference "{customer.customerRef}". CRM-mapped fields below will stay blank until this customer's ref matches one.
              </div>
            )}
            {crmProfile.salesforceAvailable && crmProfile.crmMatched === true && (
              <div className="flex items-center gap-1.5 text-[11px] text-green-600 mb-2">
                <CheckCircle2 size={11} /> Linked to Salesforce
              </div>
            )}
            {crmProfile.profile.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No profile attributes configured — set these up under Admin → Customer Schema.</p>
            ) : (
              crmProfile.profile.map(attr => (
                <ProfileAttributeRow key={attr.key} attr={attr} customerId={customerId} />
              ))
            )}
          </>
        )}
      </div>

      {!isLoading && !isError && crmProfile.relationships?.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3 space-y-4">
          {crmProfile.relationships.map(rel => (
            <RelationshipSection key={rel.typeId} relationship={rel} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── One case, expandable to its grouped checklist ────────────────────────────
function CaseCard({ caseItem, isAdmin, onViewDocument }) {
  const [expanded, setExpanded] = useState(false)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['admin', 'cases', caseItem.id, 'checklist', 'grouped'],
    queryFn: () => getCaseChecklistGrouped(caseItem.id),
    enabled: expanded,
  })

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 hover:bg-gray-50 text-left">
        <div className="flex items-center gap-2.5">
          {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          <span className="text-sm font-medium text-gray-900">{CASE_TYPE_LABELS[caseItem.caseType] ?? caseItem.caseType}</span>
          {caseItem.productName && <span className="text-xs text-gray-400">· {caseItem.productName}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{caseItem.status}</span>
          <Link to={`/cases/${caseItem.id}`} onClick={e => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-700">Open case →</Link>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6 text-gray-400"><Loader2 size={18} className="animate-spin" /></div>
          ) : groups.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No document types configured for this product.</p>
          ) : (
            groups.map(group => (
              <div key={group.categoryId ?? 'uncategorized'}>
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText size={11} /> {group.categoryName}
                </h4>
                <div className="space-y-2">
                  {group.items.map(item => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item} caseId={caseItem.id} caseStatus={caseItem.status}
                      partyExternalId={caseItem.partyExternalId} isAdmin={isAdmin}
                      onWaive={() => {}}
                      onViewDocument={onViewDocument}
                      onViewWorkflow={() => {}}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useUserStore()
  const userRoles = user?.roles ?? []
  const isAdmin = userRoles.some(r => r === 'ECM_ADMIN' || r === 'ECM_SUPER_ADMIN')
  const [viewingDocId, setViewingDocId] = useState(null)

  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ['admin', 'customers', id],
    queryFn: () => getCustomer(id),
  })

  const { data: casesPage, isLoading: casesLoading } = useQuery({
    queryKey: ['admin', 'cases', 'byParty', id],
    queryFn: () => listCases({ partyId: id, caseType: 'LOAN_ORIGINATION,ACCOUNT_OPENING', size: 50 }),
    enabled: !!id,
  })
  const cases = Array.isArray(casesPage) ? casesPage : (casesPage?.content ?? [])

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  }
  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <AlertCircle size={28} className="mb-2" />
        <p className="text-sm">Customer not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{customer.displayName}</h1>
        <p className="text-sm text-gray-500 mt-0.5 font-mono">{customer.customerRef}</p>
      </div>

      <ProfileSection customer={customer} customerId={id} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Cases</h2>
        {casesLoading ? (
          <div className="flex justify-center py-6 text-gray-400"><RefreshCw size={18} className="animate-spin" /></div>
        ) : cases.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No loan or account-opening cases for this customer yet.</p>
        ) : (
          <div className="space-y-2">
            {cases.map(c => (
              <CaseCard key={c.id} caseItem={{ ...c, partyExternalId: customer.customerRef }}
                isAdmin={isAdmin} onViewDocument={setViewingDocId} />
            ))}
          </div>
        )}
      </div>

      {viewingDocId && (
        <DocumentViewerModal documentId={viewingDocId} onClose={() => setViewingDocId(null)} />
      )}
    </div>
  )
}
