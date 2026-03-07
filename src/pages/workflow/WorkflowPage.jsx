import { useQuery } from "@tanstack/react-query";
import apiClient from "../../api/apiClient";
import { useSlaSummary, useSlaOverdue } from "../../hooks/useWorkflow";
import { AlertTriangle, Clock, CheckCircle, Zap } from "lucide-react";

const STATUS_CONFIG = {
  ON_TRACK:  { label: "On Track",  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200", Icon: CheckCircle },
  WARNING:   { label: "Warning",   color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", Icon: Clock },
  ESCALATED: { label: "Escalated", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", Icon: Zap },
  BREACHED:  { label: "Breached",  color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    Icon: AlertTriangle },
};

function SlaCard({ statusKey, count }) {
  const cfg = STATUS_CONFIG[statusKey];
  if (!cfg) return null;
  const { label, color, bg, border, Icon } = cfg;
  return (
    <div className={`${bg} ${border} border rounded-xl p-5 flex items-center gap-4`}>
      <div className={`${color} bg-white rounded-lg p-2.5 shadow-sm`}>
        <Icon size={22}/>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count ?? 0}</p>
        <p className={`text-sm font-medium ${color}`}>{label}</p>
      </div>
    </div>
  );
}

function formatDeadline(deadline) {
  if (!deadline) return "—";
  const dt = new Date(deadline);
  const now = new Date();
  const diffHrs = Math.round((dt - now) / 36e5);
  if (diffHrs < 0) return <span className="text-red-600 font-medium">{Math.abs(diffHrs)}h overdue</span>;
  if (diffHrs < 4) return <span className="text-yellow-600 font-medium">{diffHrs}h left</span>;
  return <span className="text-gray-600">{dt.toLocaleString()}</span>;
}

export default function WorkflowSlaPage() {
  const { data: summary } = useQuery({
    queryKey: ["sla-summary"],
    queryFn: () => useSlaSummary(),
    //queryFn: () => apiClient.get("/api/workflow/sla/summary").then(r => r.data ?? {}),
    refetchInterval: 60_000,
  });

  const { data: overdue, isLoading } = useQuery({
    queryKey: ["sla-overdue"],
    queryFn: () => useSlaOverdue(),
    //queryFn: () => apiClient.get("/api/workflow/sla/overdue").then(r => r.data ?? []),
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Workflow SLA Monitor</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.keys(STATUS_CONFIG).map(key => (
          <SlaCard key={key} statusKey={key} count={summary?.[key]}/>
        ))}
      </div>

      {/* Overdue table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active SLA Breaches & Warnings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Refreshes every 60 seconds</p>
        </div>
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Instance ID", "Template", "Status", "Deadline", "Escalation Group", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!overdue || overdue.length === 0) && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No active SLA issues 🎉</td></tr>
              )}
              {overdue?.map(row => {
                const cfg = STATUS_CONFIG[row.status] || {};
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {row.workflowInstanceId?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.template?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDeadline(row.slaDeadline)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.template?.escalationGroupKey || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-blue-600 hover:underline">View</button>
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