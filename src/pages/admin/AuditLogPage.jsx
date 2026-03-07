/**
 * AuditLogPage.jsx
 * Route: /admin/audit
 *
 * Filterable, paginated audit log for ECM_ADMIN users.
 * Reads from GET /api/admin/audit via useAuditLog hook.
 */
import { useState } from 'react'
import { ClipboardList, Download, Search } from 'lucide-react'
import { useAuditLog } from '../../hooks/useAdmin'

const EVENTS = [
  'DOCUMENT_UPLOAD', 'DOCUMENT_DELETED', 'DOCUMENT_DOWNLOAD',
  'WORKFLOW_STARTED', 'WORKFLOW_CANCELLED', 'WORKFLOW_COMPLETED',
  'FORM_SUBMITTED', 'FORM_PUBLISHED', 'FORM_ARCHIVED',
  'USER_DEACTIVATED', 'USER_REACTIVATED',
  'TENANT_CONFIG_UPDATED',
  'SEGMENT_CREATED', 'SEGMENT_UPDATED',
  'PRODUCT_LINE_CREATED', 'PRODUCT_LINE_UPDATED',
]

const SEVERITIES = ['INFO', 'WARN', 'ERROR']

const RESOURCE_TYPES = [
  'DOCUMENT', 'WORKFLOW', 'FORM', 'USER',
  'SEGMENT', 'PRODUCT_LINE', 'TENANT_CONFIG',
]

function severityBadge(severity) {
  switch (severity) {
    case 'ERROR': return 'bg-red-50 text-red-600'
    case 'WARN':  return 'bg-amber-50 text-amber-600'
    default:      return 'bg-gray-100 text-gray-500'
  }
}

function formatDateTime(value) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('en-CA', { hour12: false }) }
  catch { return '—' }
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    event: '', resourceType: '', severity: '', page: 0, size: 50,
  })

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 0 }))

  const { data, isLoading } = useAuditLog(filters)

  const rows       = data?.content      ?? []
  const total      = data?.totalElements ?? 0
  const totalPages = data?.totalPages    ?? 0

  return (
    <div className="p-6 space-y-4 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-purple-500" /> Audit Log
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Immutable record of all platform events
          </p>
        </div>
        <div className="text-xs text-gray-400">{total.toLocaleString()} total records</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Event */}
        <select
          value={filters.event}
          onChange={e => setFilter('event', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All events</option>
          {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        {/* Resource type */}
        <select
          value={filters.resourceType}
          onChange={e => setFilter('resourceType', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All resources</option>
          {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Severity */}
        <select
          value={filters.severity}
          onChange={e => setFilter('severity', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Page size */}
        <select
          value={filters.size}
          onChange={e => setFilters(f => ({ ...f, size: parseInt(e.target.value), page: 0 }))}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
        </select>

        {/* Reset */}
        {(filters.event || filters.resourceType || filters.severity) && (
          <button
            onClick={() => setFilters({ event: '', resourceType: '', severity: '', page: 0, size: 50 })}
            className="text-xs text-blue-600 hover:underline">
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Time', 'User', 'Event', 'Resource', 'Severity', 'IP', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading audit records…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    No audit records match the current filters
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-gray-50 transition-colors">

                  {/* Time */}
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                    {formatDateTime(row.created_at)}
                  </td>

                  {/* User */}
                  <td className="px-4 py-2.5 text-xs text-gray-700 max-w-[140px] truncate"
                    title={row.user_email ?? row.user_id}>
                    {row.user_email ?? row.entra_object_id ?? '—'}
                  </td>

                  {/* Event */}
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {row.event_type}
                    </span>
                  </td>

                  {/* Resource */}
                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                    {row.resource_type}
                    {row.resource_id ? (
                      <span className="text-gray-400 ml-1">#{String(row.resource_id).substring(0, 8)}</span>
                    ) : null}
                  </td>

                  {/* Severity */}
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge(row.severity)}`}>
                      {row.severity ?? 'INFO'}
                    </span>
                  </td>

                  {/* IP */}
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">
                    {row.ip_address ?? '—'}
                  </td>

                  {/* Details */}
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[220px] truncate"
                    title={row.payload ? JSON.stringify(row.payload) : ''}>
                    {row.payload ?? '—'}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <button
            disabled={filters.page === 0}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {filters.page + 1} of {totalPages}
            {' · '}{total.toLocaleString()} records
          </span>
          <button
            disabled={filters.page >= totalPages - 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            Next
          </button>
        </div>
      )}

    </div>
  )
}