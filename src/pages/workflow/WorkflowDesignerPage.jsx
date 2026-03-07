/**
 * WorkflowDesignerPage.jsx
 * Route: /workflow/designer
 *
 * Low-code workflow template designer.
 * - Lists all workflow templates (GET /api/workflow/templates)
 * - Create / edit / publish templates
 * - Visual step builder: drag steps from palette onto canvas
 * - Map templates to products + document categories
 * - Preview generated BPMN XML
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, PlayCircle, Edit3, Eye, CheckCircle, Archive,
  Grip, Trash2, ChevronRight, ChevronDown, Clock, AlertTriangle,
  Users, FileCheck, PenTool, Bell, GitMerge, Save, X, Loader2,
  ArrowRight, ArrowDown, Info
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import toast from 'react-hot-toast';

// ── API helpers ───────────────────────────────────────────────────────────────

const wfApi = {
  listTemplates:  ()      => apiClient.get('/api/workflow/templates').then(r => r.data?.data ?? []),
  getTemplate:    (id)    => apiClient.get(`/api/workflow/templates/${id}`).then(r => r.data?.data),
  createTemplate: (body)  => apiClient.post('/api/workflow/templates', body).then(r => r.data?.data),
  updateDsl:      (id, dsl) => apiClient.put(`/api/workflow/templates/${id}/dsl`, dsl).then(r => r.data?.data),
  publish:        (id)    => apiClient.post(`/api/workflow/templates/${id}/publish`).then(r => r.data?.data),
  deprecate:      (id)    => apiClient.post(`/api/workflow/templates/${id}/deprecate`).then(r => r.data?.data),
  previewBpmn:    (id)    => apiClient.get(`/api/workflow/templates/${id}/preview-bpmn`).then(r => r.data),
  listProducts:   ()      => apiClient.get('/api/admin/products').then(r => { const d = r.data?.data ?? r.data ?? []; return Array.isArray(d) ? d : d.content ?? []; }),
  addMapping:     (id, body) => apiClient.post(`/api/workflow/templates/${id}/mappings`, body).then(r => r.data?.data),
  getMappings:    (id)    => apiClient.get(`/api/workflow/templates/${id}/mappings`).then(r => r.data?.data ?? []),
};

// ── Step type catalogue ───────────────────────────────────────────────────────

const STEP_TYPES = [
  { type: 'REVIEW',   label: 'Review',   icon: Eye,       color: 'bg-blue-100 text-blue-700 border-blue-300',   desc: 'Backoffice review task' },
  { type: 'APPROVE',  label: 'Approve',  icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-300', desc: 'Approval with pass/fail' },
  { type: 'VERIFY',   label: 'Verify',   icon: FileCheck, color: 'bg-indigo-100 text-indigo-700 border-indigo-300', desc: 'Verification against records' },
  { type: 'SIGN',     label: 'Sign',     icon: PenTool,   color: 'bg-purple-100 text-purple-700 border-purple-300', desc: 'DocuSign e-signature step' },
  { type: 'NOTIFY',   label: 'Notify',   icon: Bell,      color: 'bg-yellow-100 text-yellow-700 border-yellow-300', desc: 'Send notification' },
  { type: 'BRANCH',   label: 'Branch',   icon: GitMerge,  color: 'bg-orange-100 text-orange-700 border-orange-300', desc: 'Conditional fork' },
];

const ROLES = ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER', 'ECM_DESIGNER', 'ECM_READONLY'];

const STATUS_BADGE = {
  PUBLISHED:   'bg-green-100 text-green-700',
  DRAFT:       'bg-yellow-100 text-yellow-700',
  DEPRECATED:  'bg-gray-100 text-gray-500',
};

// ── Helper: new step ──────────────────────────────────────────────────────────

let stepSeq = 100;
function newStep(type) {
  const meta = STEP_TYPES.find(s => s.type === type) ?? STEP_TYPES[0];
  return {
    id: `step-${++stepSeq}`,
    type,
    name: meta.label,
    assigneeRole: 'ECM_BACKOFFICE',
    description: meta.desc,
    order: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP CARD (canvas)
// ══════════════════════════════════════════════════════════════════════════════
function StepCard({ step, index, total, onEdit, onDelete, onMove }) {
  const meta  = STEP_TYPES.find(s => s.type === step.type) ?? STEP_TYPES[0];
  const Icon  = meta.icon;
  return (
    <div className="relative group">
      <div className={`flex items-start gap-3 p-3 rounded-xl border-2 ${meta.color} bg-white shadow-sm`}>
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{step.name}</span>
            <span className="text-xs opacity-60 whitespace-nowrap">{meta.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{step.description || '—'}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <Users size={11} className="text-gray-400" />
            <span className="text-xs text-gray-500">{step.assigneeRole}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(index)} className="p-1 hover:bg-white/70 rounded">
            <Edit3 size={13} />
          </button>
          <button onClick={() => onDelete(index)} className="p-1 hover:bg-white/70 rounded text-red-500">
            <Trash2 size={13} />
          </button>
          {index > 0 && (
            <button onClick={() => onMove(index, -1)} className="p-1 hover:bg-white/70 rounded text-gray-500 rotate-90">
              <ArrowRight size={13} />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(index, 1)} className="p-1 hover:bg-white/70 rounded text-gray-500 -rotate-90">
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
      {index < total - 1 && (
        <div className="flex justify-center my-1">
          <ArrowDown size={16} className="text-gray-300" />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP EDITOR MODAL
// ══════════════════════════════════════════════════════════════════════════════
function StepEditorModal({ step, onSave, onClose }) {
  const [form, setForm] = useState({ ...step });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const meta = STEP_TYPES.find(s => s.type === form.type) ?? STEP_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Edit Step</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step Type</label>
            <div className="grid grid-cols-3 gap-2">
              {STEP_TYPES.map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => set('type', type)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs font-medium transition-all
                    ${form.type === type ? color : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step Name</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Role</label>
            <select
              value={form.assigneeRole}
              onChange={e => set('assigneeRole', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save Step
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE EDITOR
// ══════════════════════════════════════════════════════════════════════════════
function TemplateEditor({ template, onClose, onSaved }) {
  const qc   = useQueryClient();
  const isNew = !template?.id;

  // Parse existing DSL or bootstrap a new one
  const initDsl = () => {
    if (template?.dslDefinition) {
      const raw = typeof template.dslDefinition === 'string'
        ? JSON.parse(template.dslDefinition)
        : template.dslDefinition;
      return raw;
    }
    return { processKey: '', name: '', steps: [], variables: {}, endStates: ['COMPLETED_APPROVED', 'COMPLETED_REJECTED'] };
  };

  const [name,       setName]       = useState(template?.name ?? '');
  const [desc,       setDesc]       = useState(template?.description ?? '');
  const [slaHours,   setSlaHours]   = useState(template?.slaHours ?? 48);
  const [warnPct,    setWarnPct]    = useState(template?.warningThresholdPct ?? 80);
  const [dsl,        setDsl]        = useState(initDsl);
  const [editingIdx, setEditingIdx] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState('canvas'); // canvas | json | sla

  const steps = dsl.steps ?? [];

  const updateSteps = (fn) => setDsl(d => ({ ...d, steps: fn(d.steps ?? []) }));

  const addStep = (type) => {
    const step = newStep(type);
    updateSteps(prev => {
      const updated = [...prev, { ...step, order: prev.length + 1 }];
      return updated;
    });
  };

  const deleteStep = (idx) => updateSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));

  const editStep = (idx) => setEditingIdx(idx);

  const saveStep = (updated) => {
    updateSteps(prev => prev.map((s, i) => i === editingIdx ? { ...s, ...updated } : s));
    setEditingIdx(null);
  };

  const moveStep = (idx, dir) => {
    updateSteps(prev => {
      const arr = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const buildDsl = () => ({
    ...dsl,
    processKey: dsl.processKey || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    name,
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
  });

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    if (steps.length === 0) { toast.error('Add at least one step'); return; }
    setSaving(true);
    try {
      let saved;
      if (isNew) {
        saved = await wfApi.createTemplate({
          dsl: buildDsl(),
          slaHours,
          warningThresholdPct: warnPct,
        });
        toast.success('Template created');
      } else {
        saved = await wfApi.updateDsl(template.id, buildDsl());
        toast.success('Template updated');
      }
      qc.invalidateQueries({ queryKey: ['workflow-templates'] });
      onSaved?.(saved);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'canvas', label: 'Visual Designer' },
    { id: 'sla',    label: 'SLA & Config' },
    { id: 'json',   label: 'DSL JSON' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex bg-gray-50">
      {/* Sidebar / palette */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-sm text-gray-900">Step Palette</h2>
          <p className="text-xs text-gray-400 mt-0.5">Click to add to canvas</p>
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          {STEP_TYPES.map(({ type, label, icon: Icon, color, desc: d }) => (
            <button
              key={type}
              onClick={() => addStep(type)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all hover:shadow-sm ${color}`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <div>
                <div className="font-medium text-xs">{label}</div>
                <div className="text-xs opacity-70 leading-tight">{d}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 text-xs text-gray-400 leading-tight">
          <Info size={12} className="inline mr-1" />
          Steps execute top-to-bottom. Each step is a human task assigned to the selected role.
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workflow template name…"
            className="flex-1 text-base font-semibold bg-transparent border-none outline-none text-gray-900 placeholder-gray-300 min-w-0"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                  ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>

        {/* Canvas */}
        {tab === 'canvas' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-sm mx-auto">
              {/* Start node */}
              <div className="flex justify-center mb-2">
                <div className="px-4 py-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold">
                  START — Document Uploaded
                </div>
              </div>
              {steps.length > 0 && (
                <div className="flex justify-center my-1">
                  <ArrowDown size={16} className="text-gray-300" />
                </div>
              )}

              {steps.length === 0 && (
                <div className="py-16 flex flex-col items-center gap-3 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <Plus size={28} className="text-gray-300" />
                  <p className="text-sm">Click a step type from the palette to begin</p>
                </div>
              )}

              {steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  total={steps.length}
                  onEdit={editStep}
                  onDelete={deleteStep}
                  onMove={moveStep}
                />
              ))}

              {steps.length > 0 && (
                <>
                  <div className="flex justify-center my-1">
                    <ArrowDown size={16} className="text-gray-300" />
                  </div>
                  <div className="flex justify-center gap-3">
                    <div className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
                      APPROVED
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold border border-red-200">
                      REJECTED
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* SLA & Config */}
        {tab === 'sla' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-md mx-auto space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm">SLA Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SLA Hours</label>
                    <input
                      type="number" min={1} value={slaHours}
                      onChange={e => setSlaHours(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <p className="text-xs text-gray-400 mt-1">Time to complete before breach</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Warning Threshold %</label>
                    <input
                      type="number" min={1} max={99} value={warnPct}
                      onChange={e => setWarnPct(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <p className="text-xs text-gray-400 mt-1">Alert at {warnPct}% of SLA elapsed</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm">Description</h3>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe when this workflow is used…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* DSL JSON preview */}
        {tab === 'json' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-4 overflow-auto">
                <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(buildDsl(), null, 2)}
                </pre>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                This DSL is stored in the workflow_templates.dsl_definition JSONB column
                and generates a Flowable BPMN process on publish.
              </p>
            </div>
          </div>
        )}
      </div>

      {editingIdx !== null && (
        <StepEditorModal
          step={steps[editingIdx]}
          onSave={saveStep}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CARD
// ══════════════════════════════════════════════════════════════════════════════
function TemplateCard({ template, onEdit, onPublish, onDeprecate }) {
  const [showDetails, setShowDetails] = useState(false);
  const statusClass = STATUS_BADGE[template.status] ?? STATUS_BADGE.DRAFT;

  const steps = (() => {
    try {
      const dsl = typeof template.dslDefinition === 'string'
        ? JSON.parse(template.dslDefinition)
        : template.dslDefinition;
      return dsl?.steps ?? [];
    } catch { return []; }
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm">{template.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                {template.status}
              </span>
              {template.isDefault && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{template.description || '—'}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(template)} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-700">
              <Edit3 size={15} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><ChevronRight size={12} />{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><Clock size={12} />{template.slaHours ?? 48}h SLA</span>
          {template.processKey && (
            <span className="font-mono text-gray-400">{template.processKey}</span>
          )}
        </div>

        {/* Steps preview */}
        {steps.length > 0 && (
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {steps.map((s, i) => {
              const meta = STEP_TYPES.find(t => t.type === s.type) ?? STEP_TYPES[0];
              const Icon = meta.icon;
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
                    <Icon size={10} />
                    {s.name}
                  </span>
                  {i < steps.length - 1 && <ArrowRight size={10} className="text-gray-300" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
        {template.status === 'DRAFT' && (
          <button
            onClick={() => onPublish(template)}
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100"
          >
            <PlayCircle size={13} /> Publish
          </button>
        )}
        {template.status === 'PUBLISHED' && (
          <button
            onClick={() => onDeprecate(template)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-200"
          >
            <Archive size={13} /> Deprecate
          </button>
        )}
        <button
          onClick={() => onEdit(template)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100"
        >
          <Edit3 size={13} /> Edit
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function WorkflowDesignerPage() {
  const qc = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [showEditor, setShowEditor]           = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: wfApi.listTemplates,
    retry: 1,
    staleTime: 30_000,
  });

  const publishMut = useMutation({
    mutationFn: (t) => wfApi.publish(t.id),
    onSuccess: () => { toast.success('Template published — Flowable process deployed'); qc.invalidateQueries({ queryKey: ['workflow-templates'] }); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Publish failed'),
  });

  const deprecateMut = useMutation({
    mutationFn: (t) => wfApi.deprecate(t.id),
    onSuccess: () => { toast.success('Template deprecated'); qc.invalidateQueries({ queryKey: ['workflow-templates'] }); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Deprecate failed'),
  });

  const openNew  = () => { setEditingTemplate(null); setShowEditor(true); };
  const openEdit = (t) => { setEditingTemplate(t);   setShowEditor(true); };
  const closeEditor = () => { setShowEditor(false); setEditingTemplate(null); };

  const published  = templates.filter(t => t.status === 'PUBLISHED');
  const drafts     = templates.filter(t => t.status === 'DRAFT');
  const deprecated = templates.filter(t => t.status === 'DEPRECATED');

  if (showEditor) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onClose={closeEditor}
        onSaved={closeEditor}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workflow Designer</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Design low-code document workflow templates and map them to products
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>How it works: </strong>
        Design a template with ordered steps → Publish to deploy it to Flowable BPM →
        Map the template to a product + document category → When a document is uploaded
        for that product, the workflow triggers automatically.
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <GitMerge size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No workflow templates yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first template to get started</p>
          <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={15} /> Create Template
          </button>
        </div>
      )}

      {published.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Published ({published.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {published.map(t => (
              <TemplateCard
                key={t.id} template={t}
                onEdit={openEdit}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate}
              />
            ))}
          </div>
        </section>
      )}

      {drafts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Drafts ({drafts.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {drafts.map(t => (
              <TemplateCard
                key={t.id} template={t}
                onEdit={openEdit}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate}
              />
            ))}
          </div>
        </section>
      )}

      {deprecated.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Deprecated ({deprecated.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60">
            {deprecated.map(t => (
              <TemplateCard
                key={t.id} template={t}
                onEdit={openEdit}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}