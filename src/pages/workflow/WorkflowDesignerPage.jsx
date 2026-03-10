/**
 * WorkflowDesignerPage.jsx
 * Route: /workflow/designer
 *
 * Manages template list + open-in-designer.
 * The visual designer (palette + canvas + properties) lives in BpmnDesignerCanvas.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, PlayCircle, Edit3, Archive, Clock, GitMerge,
  X, Loader2, Info, CheckCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listTemplates, createTemplate, saveTemplateBpmn,
  publishTemplate, deprecateTemplate,
} from '../../api/workflowApi';
import BpmnDesignerCanvas from '../../components/workflow/designer/BpmnDesignerCanvas';

// ── Starter BPMN seeded into every new template ───────────────────────────
const STARTER_BPMN = (processKey, processName) =>
`<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="http://www.flowable.org/processdef">
  <process id="${processKey}" name="${processName}" isExecutable="true">
    <startEvent id="start" name="Document Uploaded" flowable:initiator="initiator"/>
    <sequenceFlow id="flow_start_review" sourceRef="start" targetRef="task_review"/>
    <userTask id="task_review" name="Review Document"
              flowable:candidateGroups="ECM_REVIEWER"
              flowable:formFieldValidation="false"/>
    <sequenceFlow id="flow_review_gw" sourceRef="task_review" targetRef="gw_decision"/>
    <exclusiveGateway id="gw_decision" name="Decision"/>
    <sequenceFlow id="flow_approve" sourceRef="gw_decision" targetRef="end_approved">
      <conditionExpression><![CDATA[\${decision == 'APPROVED'}]]></conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="flow_reject" sourceRef="gw_decision" targetRef="end_rejected">
      <conditionExpression><![CDATA[\${decision == 'REJECTED'}]]></conditionExpression>
    </sequenceFlow>
    <endEvent id="end_approved" name="Approved"/>
    <endEvent id="end_rejected" name="Rejected"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processKey}">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <omgdc:Bounds x="152" y="102" width="36" height="36"/>
        <bpmndi:BPMNLabel><omgdc:Bounds x="126" y="145" width="88" height="27"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_review_di" bpmnElement="task_review">
        <omgdc:Bounds x="250" y="80" width="120" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_decision_di" bpmnElement="gw_decision" isMarkerVisible="true">
        <omgdc:Bounds x="435" y="95" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_approved_di" bpmnElement="end_approved">
        <omgdc:Bounds x="552" y="52" width="36" height="36"/>
        <bpmndi:BPMNLabel><omgdc:Bounds x="545" y="95" width="50" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_rejected_di" bpmnElement="end_rejected">
        <omgdc:Bounds x="552" y="152" width="36" height="36"/>
        <bpmndi:BPMNLabel><omgdc:Bounds x="545" y="195" width="46" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_start_review_di" bpmnElement="flow_start_review">
        <omgdi:waypoint x="188" y="120"/><omgdi:waypoint x="250" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_review_gw_di" bpmnElement="flow_review_gw">
        <omgdi:waypoint x="370" y="120"/><omgdi:waypoint x="435" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_approve_di" bpmnElement="flow_approve">
        <omgdi:waypoint x="460" y="95"/><omgdi:waypoint x="460" y="70"/><omgdi:waypoint x="552" y="70"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_reject_di" bpmnElement="flow_reject">
        <omgdi:waypoint x="460" y="145"/><omgdi:waypoint x="460" y="170"/><omgdi:waypoint x="552" y="170"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

// ── Status / source badge styles ──────────────────────────────────────────
const STATUS_BADGE = {
  PUBLISHED:  'bg-green-100 text-green-700 border border-green-200',
  DRAFT:      'bg-yellow-100 text-yellow-700 border border-yellow-200',
  DEPRECATED: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const SOURCE_BADGE = {
  VISUAL: 'bg-purple-100 text-purple-700',
  DSL:    'bg-blue-100 text-blue-700',
};

// ── New Template Modal ────────────────────────────────────────────────────
function NewTemplateModal({ onCreated, onClose }) {
  const [name,     setName]     = useState('');
  const [slaHours, setSlaHours] = useState(48);
  const [warnPct,  setWarnPct]  = useState(80);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    setCreating(true);
    try {
      const processKey = name.toLowerCase()
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const template = await createTemplate({
        dsl: { processKey, name: name.trim(), steps: [], variables: {}, endStates: [] },
        slaHours,
        warningThresholdPct: warnPct,
      });

      // Seed starter BPMN so designer opens with a working baseline
      await saveTemplateBpmn(template.id, STARTER_BPMN(processKey, name.trim()));

      toast.success('Template created');
      onCreated(template);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">New Workflow Template</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Mortgage Application Review"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SLA Hours</label>
              <input type="number" min={1} value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Warn at %</label>
              <input type="number" min={10} max={99} value={warnPct}
                onChange={(e) => setWarnPct(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <Info size={12} className="inline mr-1" />
            A starter diagram (Start → Review Task → Decision → End) will be pre-loaded.
            Reshape it freely in the designer.
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create &amp; Design
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Editor (full-screen) ─────────────────────────────────────────
function TemplateEditor({ template, onClose }) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishTemplate(template.id);
      toast.success('Template published — Flowable process deployed');
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-bold text-gray-900 text-sm truncate">{template?.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
            ${STATUS_BADGE[template?.status] ?? STATUS_BADGE.DRAFT}`}>
            {template?.status}
          </span>
          {template?.bpmnSource && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
              ${SOURCE_BADGE[template.bpmnSource] ?? SOURCE_BADGE.DSL}`}>
              {template.bpmnSource === 'VISUAL' ? '⬡ Visual BPMN' : '{ } DSL'}
            </span>
          )}
          {template?.processKey && (
            <span className="text-xs font-mono text-gray-400 hidden lg:block truncate max-w-[180px]">
              {template.processKey}
            </span>
          )}
        </div>

        {template?.status === 'DRAFT' && (
          <button onClick={handlePublish} disabled={publishing}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            Publish to Flowable
          </button>
        )}
        {template?.status === 'PUBLISHED' && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle size={13} /> Live
          </span>
        )}
      </div>

      {/* Designer canvas */}
      <div className="flex-1 flex min-h-0">
        <BpmnDesignerCanvas
          templateId={template.id}
          onSaved={() => qc.invalidateQueries({ queryKey: ['wf-templates'] })}
        />
      </div>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onPublish, onDeprecate }) {
  const [expanded, setExpanded] = useState(false);
  const isDeprecated = template.status === 'DEPRECATED';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-opacity ${isDeprecated ? 'opacity-60' : ''}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm">{template.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[template.status] ?? STATUS_BADGE.DRAFT}`}>
                {template.status}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[template.bpmnSource] ?? SOURCE_BADGE.DSL}`}>
                {template.bpmnSource === 'VISUAL' ? '⬡ Visual' : '{ } DSL'}
              </span>
              {template.isDefault && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Default</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {template.description || 'No description'}
            </p>
          </div>
          <button onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-600 p-1">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock size={11} /> {template.slaHours ?? 48}h SLA</span>
          {template.processKey && (
            <span className="font-mono text-gray-400 truncate max-w-[160px]">{template.processKey}</span>
          )}
        </div>

        {expanded && template.processKey && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 space-y-1">
            <div><span className="text-gray-400">processKey: </span>{template.processKey}</div>
            {template.flowableProcessDefId && (
              <div><span className="text-gray-400">flowableDefId: </span>
                <span className="text-gray-500">{template.flowableProcessDefId}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-100">
        {template.status === 'DRAFT' && (
          <button onClick={() => onPublish(template)}
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100">
            <PlayCircle size={13} /> Publish
          </button>
        )}
        {template.status === 'PUBLISHED' && (
          <button onClick={() => onDeprecate(template)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-200">
            <Archive size={13} /> Deprecate
          </button>
        )}
        <button onClick={() => onEdit(template)}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100">
          <Edit3 size={13} /> Open Designer
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function WorkflowDesignerPage() {
  const qc = useQueryClient();
  const [showNewModal,    setShowNewModal]    = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['wf-templates'],
    queryFn: listTemplates,
    retry: 1,
    staleTime: 30_000,
  });

  const publishMut = useMutation({
    mutationFn: (t) => publishTemplate(t.id),
    onSuccess: () => {
      toast.success('Template published');
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Publish failed'),
  });

  const deprecateMut = useMutation({
    mutationFn: (t) => deprecateTemplate(t.id),
    onSuccess: () => {
      toast.success('Template deprecated');
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Deprecate failed'),
  });

  const handleTemplateCreated = (template) => {
    setShowNewModal(false);
    qc.invalidateQueries({ queryKey: ['wf-templates'] });
    setEditingTemplate(template);
  };

  // Open designer full-screen
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  const published  = templates.filter((t) => t.status === 'PUBLISHED');
  const drafts     = templates.filter((t) => t.status === 'DRAFT');
  const deprecated = templates.filter((t) => t.status === 'DEPRECATED');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workflow Designer</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Design BPMN 2.0 processes and map them to document categories
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm">
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
        <strong>How it works: </strong>
        Create a template → open the visual designer → drag ECM shapes from the left palette
        onto the canvas → click shapes to configure their Flowable properties in the right panel
        → Save BPMN → Publish → map to a document category → uploads auto-trigger the workflow.
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <GitMerge size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">No workflow templates yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first template to start designing
          </p>
          <button onClick={() => setShowNewModal(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={15} /> Create Template
          </button>
        </div>
      )}

      {published.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Published ({published.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {published.map((t) => (
              <TemplateCard key={t.id} template={t}
                onEdit={setEditingTemplate}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate} />
            ))}
          </div>
        </section>
      )}

      {drafts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" /> Drafts ({drafts.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {drafts.map((t) => (
              <TemplateCard key={t.id} template={t}
                onEdit={setEditingTemplate}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate} />
            ))}
          </div>
        </section>
      )}

      {deprecated.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400" /> Deprecated ({deprecated.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {deprecated.map((t) => (
              <TemplateCard key={t.id} template={t}
                onEdit={setEditingTemplate}
                onPublish={publishMut.mutate}
                onDeprecate={deprecateMut.mutate} />
            ))}
          </div>
        </section>
      )}

      {showNewModal && (
        <NewTemplateModal
          onCreated={handleTemplateCreated}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}