/**
 * AuditLogPage.jsx
 * Route: /admin/audit
 *
 * Filterable, paginated audit log for ECM_ADMIN users.
 * Reads from GET /api/admin/audit via useAuditLog hook.
 *
 * Fix: payload column is PostgreSQL JSONB. Spring JDBC's queryForList returns
 * it as a PGobject, which Jackson serialises to:
 *   { type: "jsonb", value: "{\"outcome\":\"SUCCESS\"}", null: false }
 * Rendering that object directly causes:
 *   "Objects are not valid as a React child (found: object with keys {type, value, null})"
 *
 * parsePayload() unwraps the PGobject envelope and parses the inner JSON string.
 * All other cell values are coerced to strings before rendering to prevent the
 * same crash if other JDBC types (Timestamp, UUID) come through unexpectedly.
 */
import { useState } from 'react'
import { ClipboardList, ChevronDown } from 'lucide-react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Unwrap the PostgreSQL PGobject envelope that Spring JDBC produces for JSONB columns.
 *
 * Spring JDBC queryForList() returns JSONB as a PGobject.
 * Jackson serialises PGobject to: { type: "jsonb", value: "<json-string>", null: false }
 *
 * Three possible shapes to handle:
 *   1. null / undefined             → return {}
 *   2. PGobject envelope (object)   → extract .value string, then JSON.parse
 *   3. Already a plain object/string → parse directly (shouldn't happen, but safe)
 */
function parsePayload(raw) {
  if (raw == null) return {}

  // Shape 2: PGobject envelope — { type: "jsonb", value: "{...}", null: false }
  if (typeof raw === 'object' && 'value' in raw && 'type' in raw) {
    try { return JSON.parse(raw.value) } catch { return {} }
  }

  // Shape 3a: plain JSON string
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return { raw } }
  }

  // Shape 3b: already a plain object (Jackson fully deserialized it)
  if (typeof raw === 'object') return raw

  return {}
}

/**
 * Safe string coercion for any JDBC value.
 * Handles: string, number, Date/Timestamp (object with toISOString), null.
 */
function safeStr(val) {
  if (val == null) return null
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object' && typeof val.toISOString === 'function') return val.toISOString()
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

/**
 * Format a timestamp that may arrive as:
 *  - ISO string   "2025-03-06T14:23:11.123Z"
 *  - PGobject     { type: "timestamptz", value: "...", null: false }
 *  - epoch millis (number)
 */
function formatDateTime(raw) {
  if (raw == null) return '—'
  // Unwrap PGobject if needed
  const value = (typeof raw === 'object' && 'value' in raw) ? raw.value : raw
  try {
    const d = typeof value === 'number' ? new Date(value) : new Date(value)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleString('en-CA', { hour12: false })
  } catch {
    return String(value)
  }
}

function severityBadge(severity) {
  switch (severity) {
    case 'ERROR': return 'bg-red-50 text-red-600'
    case 'WARN':  return 'bg-amber-50 text-amber-600'
    default:      return 'bg-gray-100 text-gray-500'
  }
}

function outcomeBadge(outcome) {
  switch (outcome) {
    case 'SUCCESS': return 'text-green-600 font-medium'
    case 'FAILURE': return 'text-red-500 font-medium'
    default:        return 'text-gray-400'
  }
}

// ── Expandable Audit Row ──────────────────────────────────────────────────────

function AuditRow({ row }) {
  const [expanded, setExpanded] = useState(false)
  const pl = parsePayload(row.payload)
  const outcome = safeStr(pl.outcome)
  const errorDetail = safeStr(pl.error)
  const resourceId = safeStr(row.resource_id)
  const userEmail = safeStr(row.user_email)
  const entraId = safeStr(row.entra_object_id)
  const eventType = safeStr(row.event_type)
  const resourceType = safeStr(row.resource_type)
  const severity = safeStr(row.severity)
  const ip = safeStr(row.ip_address)

  return (
    <>
      <tr onClick={() => setExpanded(v => !v)}
        className="hover:bg-gray-50 transition-colors cursor-pointer">
        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
          {formatDateTime(row.created_at)}
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-700 max-w-[140px] truncate" title={userEmail ?? entraId ?? ''}>
          {userEmail ?? entraId ?? '—'}
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-mono bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 whitespace-nowrap">
            {eventType ?? '—'}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
          {resourceType ?? '—'}
          {resourceId ? <span className="text-gray-400 ml-1">#{resourceId.substring(0, 8)}</span> : null}
        </td>
        <td className="px-4 py-2.5 text-xs">
          <span className={outcomeBadge(outcome)}>{outcome ?? '—'}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityBadge(severity)}`}>
            {severity ?? 'INFO'}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{ip ?? '—'}</td>
        <td className="px-4 py-2.5">
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div><span className="text-gray-500 font-medium">User:</span> <span className="text-gray-700">{userEmail ?? '—'}</span></div>
              <div><span className="text-gray-500 font-medium">Entra ID:</span> <span className="text-gray-700 font-mono">{entraId ?? '—'}</span></div>
              <div><span className="text-gray-500 font-medium">Event:</span> <span className="text-gray-700">{eventType}</span></div>
              <div><span className="text-gray-500 font-medium">Resource:</span> <span className="text-gray-700">{resourceType} {resourceId ? `#${resourceId}` : ''}</span></div>
              <div><span className="text-gray-500 font-medium">IP:</span> <span className="text-gray-700 font-mono">{ip ?? '—'}</span></div>
              <div><span className="text-gray-500 font-medium">Severity:</span> <span className="text-gray-700">{severity}</span></div>
              {errorDetail && (
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Error Detail:</span>
                  <pre className="mt-1 text-xs text-red-600 bg-red-50 rounded-lg p-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                    {errorDetail}
                  </pre>
                </div>
              )}
              {Object.keys(pl).length > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-500 font-medium">Full Payload:</span>
                  <pre className="mt-1 text-xs text-gray-600 bg-gray-100 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                    {JSON.stringify(pl, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    event: '', resourceType: '', severity: '', page: 0, size: 50,
  })

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 0 }))

  const { data, isLoading, isError } = useAuditLog(filters)

  const rows       = data?.content      ?? []
  const total      = data?.totalElements ?? 0
  const totalPages = data?.totalPages    ?? 0

  const hasFilters = filters.event || filters.resourceType || filters.severity

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
        <div className="text-xs text-gray-400 tabular-nums">{total.toLocaleString()} total records</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.event}
          onChange={e => setFilter('event', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All events</option>
          {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={filters.resourceType}
          onChange={e => setFilter('resourceType', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All resources</option>
          {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={filters.severity}
          onChange={e => setFilter('severity', e.target.value)}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filters.size}
          onChange={e => setFilters(f => ({ ...f, size: parseInt(e.target.value), page: 0 }))}
          className="rounded-lg border border-gray-200 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => setFilters({ event: '', resourceType: '', severity: '', page: 0, size: 50 })}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Time', 'User', 'Event', 'Resource', 'Outcome', 'Severity', 'IP', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    Loading audit records…
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-red-400">
                    Failed to load audit records. Check that ecm-admin is running.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    {hasFilters
                      ? 'No records match the current filters.'
                      : 'No audit records yet. They appear as users perform actions.'}
                  </td>
                </tr>
              )}

              {rows.map((row, i) => (
                <AuditRow key={row.id ?? i} row={row} />
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
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {filters.page + 1} of {totalPages}
            {' · '}{total.toLocaleString()} records
          </span>
          <button
            disabled={filters.page >= totalPages - 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}

    </div>
  )
}