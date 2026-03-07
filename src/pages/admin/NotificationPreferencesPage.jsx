import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../api/apiClient";
import { Bell, Mail, Smartphone, Save, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

const NOTIFICATION_EVENTS = [
  { key: "notif.document.uploaded",    label: "Document Uploaded",       description: "When a new document is submitted" },
  { key: "notif.workflow.assigned",    label: "Task Assigned to Me",     description: "When a workflow task lands in your queue" },
  { key: "notif.workflow.completed",   label: "Workflow Completed",      description: "When a document is approved or rejected" },
  { key: "notif.sla.warning",          label: "SLA Warning",             description: "When a workflow approaches its deadline" },
  { key: "notif.sla.breached",         label: "SLA Breached",            description: "When a workflow exceeds its SLA" },
  { key: "notif.sla.escalated",        label: "SLA Escalated",           description: "When a workflow is auto-escalated" },
  { key: "notif.form.submitted",       label: "eForm Submitted",         description: "When a form submission is received" },
];

export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState({});

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => apiClient.get("/api/admin/config").then(r => r.data.data),
  });

  // Initialise local state from config
  useEffect(() => {
    if (!config) return;
    const initial = {};
    NOTIFICATION_EVENTS.forEach(evt => {
      const raw = config.find(c => c.configKey === evt.key)?.configValue;
      try { initial[evt.key] = raw ? JSON.parse(raw) : { email: true, inApp: true }; }
      catch { initial[evt.key] = { email: true, inApp: true }; }
    });
    setPrefs(initial);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (configs) =>
      apiClient.put("/api/admin/config", { configs }),
    onSuccess: () => {
      queryClient.invalidateQueries(["admin-config"]);
      toast.success("Notification preferences saved");
    },
    onError: () => toast.error("Failed to save preferences"),
  });

  const toggle = (eventKey, channel) => {
    setPrefs(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], [channel]: !prev[eventKey]?.[channel] },
    }));
  };

  const handleSave = () => {
    const configs = NOTIFICATION_EVENTS.map(evt => ({
      configKey: evt.key,
      configValue: JSON.stringify(prefs[evt.key] || { email: false, inApp: false }),
      description: `Notification preference: ${evt.label}`,
    }));
    saveMutation.mutate(configs);
  };

  if (isLoading) return (
    <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm">
      Loading preferences...
    </div>
  );

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500 mt-1">Control which events trigger notifications and via which channels</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
        >
          <Save size={15}/>
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Channel legend */}
      <div className="flex gap-6 text-xs text-gray-500 bg-gray-50 px-4 py-3 rounded-lg">
        <span className="flex items-center gap-1.5"><Mail size={13}/> Email notification</span>
        <span className="flex items-center gap-1.5"><Bell size={13}/> In-app notification</span>
      </div>

      {/* Preferences table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px] px-5 py-3 bg-gray-50">
          <span className="text-xs font-semibold text-gray-500 uppercase">Event</span>
          <span className="text-xs font-semibold text-gray-500 uppercase text-center flex items-center gap-1 justify-center"><Mail size={12}/> Email</span>
          <span className="text-xs font-semibold text-gray-500 uppercase text-center flex items-center gap-1 justify-center"><Bell size={12}/> In-App</span>
        </div>

        {NOTIFICATION_EVENTS.map(evt => (
          <div key={evt.key} className="grid grid-cols-[1fr_80px_80px] px-5 py-4 items-center hover:bg-gray-50 transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-900">{evt.label}</p>
              <p className="text-xs text-gray-500">{evt.description}</p>
            </div>
            {["email", "inApp"].map(channel => (
              <div key={channel} className="flex justify-center">
                <button
                  onClick={() => toggle(evt.key, channel)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    prefs[evt.key]?.[channel] ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    prefs[evt.key]?.[channel] ? "translate-x-4" : "translate-x-0.5"
                  }`}/>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}