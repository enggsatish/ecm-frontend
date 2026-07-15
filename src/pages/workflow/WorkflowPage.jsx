import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSlaSummary, useSlaOverdue } from "../../hooks/useWorkflow";
import { AlertTriangle, Clock, CheckCircle, Zap, Search, Filter } from "lucide-react";

const STATUS_CONFIG = {
  ON_TRACK:  { label: "On Track",  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200", Icon: CheckCircle },
  WARNING:   { label: "Warning",   color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", Icon: Clock },
  ESCALATED: { label: "Escalated", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", Icon: Zap },
  BREACHED:  { label: "Breached",  color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    Icon: AlertTriangle },
};

function SlaCard({ statusKey, count, active, onClick }) {
  const cfg = STATUS_CONFIG[statusKey];
  if (!cfg) return null;
  const { label, color, bg, border, Icon } = cfg;
  return (
    <button onClick={onClick}
      className={`${bg} ${border} border rounded-xl p-5 flex items-center gap-4 text-left w-full transition-all
        ${active ? 'ring-2 ring-offset-1 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}>
      <div className={`${color} bg-white rounded-lg p-2.5 shadow-sm`}>
        <Icon size={22}/>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count ?? 0}</p>
        <p className={`text-sm font-medium ${color}`}>{label}</p>
      </div>
    </button>
  );
}

function formatDeadline(deadline) {
  if (!deadline) return "—";
  const dt = new Date(deadline);
  const now = new Date();
  const diffMs = dt - now;
  const diffHrs = Math.round(diffMs / 36e5);
  if (diffHrs < 0) return <span className="text-red-600 font-medium">{Math.abs(diffHrs)}h overdue</span>;
  if (diffHrs < 4) return <span className="text-yellow-600 font-medium">{diffHrs}h left</span>;
  if (diffHrs < 24) return <span className="text-gray-700">{diffHrs}h remaining</span>;
  return <span className="text-gray-600">{Math.floor(diffHrs / 24)}d {diffHrs % 24}h remaining</span>;
}

export default function WorkflowSlaPage() {
  const navigate = useNavigate();
  const { data: summary } = useSlaSummary();
  const { data: overdue, isLoading } = useSlaOverdue();

  const [statusFilter, setStatusFilter] = useState(null); // null = all
  const [search, setSearch] = useState('');

  const items = Array.isArray(overdue) ? overdue : [];

  const filtered = items
    .filter(row => !statusFilter || row.status === statusFilter)
    .filter(row => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (row.templateName || '').toLowerCase().includes(q)
        || (row.workflowInstanceId || '').toLowerCase().includes(q)
        || (row.escalationGroupKey || '').toLowerCase().includes(q);
    });

  const handleCardClick = (key) => {
    setStatusFilter(statusFilter === key ? null : key);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">SLA Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitor workflow SLA compliance across all active tasks</p>
      </div>

      {/* Summary cards — clickable to filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.keys(STATUS_CONFIG).map(key => (
          <SlaCard key={key} statusKey={key} count={summary?.[key]}
            active={statusFilter === key}
            onClick={() => handleCardClick(key)} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {statusFilter ? (
            <span className="flex items-center gap-1.5">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[statusFilter]?.bg} ${STATUS_CONFIG[statusFilter]?.color}`}>
                {STATUS_CONFIG[statusFilter]?.label}
              </span>
              <button onClick={() => setStatusFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            </span>
          ) : (
            <span className="text-xs text-gray-400">Click a card to filter · Showing all {items.length} active SLA items</span>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search template, instance..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Active SLA Tracking</h2>
            <p className="text-xs text-gray-400 mt-0.5">Auto-refreshes every 60 seconds</p>
          </div>
          <span className="text-xs text-gray-400">{filtered.length} of {items.length} items</span>
        </div>
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Instance</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deadline</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Escalation Group</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                  {statusFilter ? 'No items match this filter' : 'No active SLA items'}
                </td></tr>
              )}
              {filtered.map(row => {
                const cfg = STATUS_CONFIG[row.status] || {};
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {row.workflowInstanceId?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {row.templateName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg || 'bg-gray-50'} ${cfg.color || 'text-gray-600'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDeadline(row.slaDeadline)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {row.escalationGroupKey || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate('/backoffice/queue')}
                        className="text-xs text-blue-600 hover:underline">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
