/**
 * WorkflowDesignerPage.jsx
 * Route: /workflow/designer
 *
 * Manages template list + open-in-designer.
 * The visual designer (palette + canvas + properties) lives in BpmnDesignerCanvas.
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, PlayCircle, Edit3, Archive, Clock, GitMerge, Eye, Copy, Trash2, Search, Link2,
  X, Loader2, Info, CheckCircle, ChevronDown, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listTemplates, createTemplate, saveTemplateBpmn,
  publishTemplate, deprecateTemplate, cloneTemplate, updateTemplateMeta,
  deleteTemplate, listCategoryMappings, createCategoryMapping, deleteCategoryMapping,
} from '../../api/workflowApi';
import { getCategories } from '../../api/adminApi';
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
  const [tagInput, setTagInput] = useState('');
  const [tags,     setTags]     = useState([]);
  const [creating, setCreating] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

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
        tags: tags.length ? tags : undefined,
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
                  {t}
                  <button onClick={() => setTags(tags.filter(x => x !== t))} className="text-gray-400 hover:text-gray-600">&times;</button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              onBlur={addTag}
              placeholder="Type a tag and press Enter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
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
function TemplateEditor({ template, onClose, onClone }) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const [editName, setEditName] = useState(template?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const isDraft = template?.status === 'DRAFT';

  const handleNameSave = async () => {
    if (!editName.trim() || editName.trim() === template?.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const processKey = editName.trim().toLowerCase()
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
      await updateTemplateMeta(template.id, { name: editName.trim(), processKey });
      template.name = editName.trim();
      template.processKey = processKey;
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
      toast.success('Template renamed');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Rename failed');
    }
    setIsEditingName(false);
  };

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isDraft && isEditingName ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setIsEditingName(false); }}
              className="font-bold text-gray-900 text-sm bg-white border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[200px]"
            />
          ) : (
            <span
              className={`font-bold text-gray-900 text-sm truncate ${isDraft ? 'cursor-pointer hover:text-blue-600' : ''}`}
              onClick={() => isDraft && setIsEditingName(true)}
              title={isDraft ? 'Click to rename' : undefined}
            >
              {template?.name}
            </span>
          )}
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

        {!isDraft && (
          <>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              Read-only — clone to edit
            </span>
            <button onClick={() => onClone(template)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              <Copy size={13} /> Clone as Draft
            </button>
          </>
        )}
        {isDraft && (
          <button onClick={handlePublish} disabled={publishing}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
            Publish to Flowable
          </button>
        )}
      </div>

      {/* Read-only notice banner for non-draft */}
      {!isDraft && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <Info size={12} />
          This template is {template?.status?.toLowerCase()}. Changes cannot be saved. Clone it to create an editable draft.
        </div>
      )}

      {/* Designer canvas */}
      <div className="flex-1 flex min-h-0">
        <BpmnDesignerCanvas
          templateId={template.id}
          readOnly={!isDraft}
          onSaved={() => qc.invalidateQueries({ queryKey: ['wf-templates'] })}
        />
      </div>
    </div>
  );
}

// ── Action Menu (fixed positioning — escapes overflow-hidden) ─────────────
function ActionMenu({ template, pos, onEdit, onPublish, onDeprecate, onClone, onDelete, onClose }) {
  const isDraft = template.status === 'DRAFT';

  const item = (label, icon, onClick, cls = 'text-gray-700 hover:bg-gray-50') => (
    <button onClick={() => { onClose(); onClick(); }}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium ${cls}`}>
      {icon} {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]"
        style={{ top: pos.top, right: pos.right }}>
        {item(isDraft ? 'Open Designer' : 'View', isDraft ? <Edit3 size={12} /> : <Eye size={12} />, () => onEdit(template))}
        {isDraft && item('Publish', <PlayCircle size={12} />, () => onPublish(template), 'text-green-700 hover:bg-green-50')}
        {template.status === 'PUBLISHED' && item('Deprecate', <Archive size={12} />, () => onDeprecate(template))}
        {!isDraft && item('Clone as Draft', <Copy size={12} />, () => onClone(template), 'text-indigo-700 hover:bg-indigo-50')}
        <div className="border-t border-gray-100 my-1" />
        {item('Delete', <Trash2 size={12} />, () => {
          if (window.confirm(`Delete "${template.name}"? This cannot be undone.`)) onDelete(template);
        }, 'text-red-600 hover:bg-red-50')}
      </div>
    </>
  );
}


// ── Category → Workflow Mappings ──────────────────────────────────────────
function CategoryMappingsSection({ templates }) {
  const qc = useQueryClient();
  const [newCatId, setNewCatId]     = useState('');
  const [newTplId, setNewTplId]     = useState('');

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['wf-category-mappings'],
    queryFn: listCategoryMappings,
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-flat'],
    queryFn: () => getCategories(true),
    staleTime: 60_000,
  });

  const publishedTemplates = templates.filter(t => t.status === 'PUBLISHED');

  const createMut = useMutation({
    mutationFn: (data) => createCategoryMapping(data),
    onSuccess: () => {
      toast.success('Mapping created');
      qc.invalidateQueries({ queryKey: ['wf-category-mappings'] });
      setNewCatId('');
      setNewTplId('');
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to create mapping'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteCategoryMapping(id),
    onSuccess: () => {
      toast.success('Mapping removed');
      qc.invalidateQueries({ queryKey: ['wf-category-mappings'] });
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to delete mapping'),
  });

  const catList = Array.isArray(categories) ? categories : [];
  const getCategoryName = (id) => catList.find(c => c.id === id)?.name || `Category #${id}`;

  // Categories already mapped
  const mappedCatIds = new Set(mappings.map(m => m.categoryId));
  const availableCategories = catList.filter(c => !mappedCatIds.has(c.id));

  const handleCreate = () => {
    if (!newCatId || !newTplId) { toast.error('Select both a category and a workflow'); return; }
    createMut.mutate({ categoryId: Number(newCatId), templateId: Number(newTplId) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-800">Category → Workflow Mappings</h2>
        <span className="text-xs text-gray-400">When a document is uploaded in a mapped category, the linked workflow starts automatically</span>
      </div>

      {/* Add mapping form */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <select value={newCatId} onChange={(e) => setNewCatId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">Select category...</option>
          {availableCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">→</span>
        <select value={newTplId} onChange={(e) => setNewTplId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">Select workflow...</option>
          {publishedTemplates.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.processKey})</option>
          ))}
        </select>
        <button onClick={handleCreate} disabled={!newCatId || !newTplId || createMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Existing mappings */}
      {loadingMappings && <div className="text-xs text-gray-400 py-4 text-center">Loading...</div>}

      {!loadingMappings && mappings.length === 0 && (
        <div className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
          No category mappings configured. Documents will only trigger a workflow if a default template is set.
        </div>
      )}

      {!loadingMappings && mappings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document Category</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow Template</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Process Key</th>
                <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="text-sm text-gray-900">{getCategoryName(m.categoryId)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm text-gray-700">{m.template?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-400">{m.template?.processKey || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => deleteMut.mutate(m.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function WorkflowDesignerPage() {
  const qc = useQueryClient();
  const [showNewModal,    setShowNewModal]    = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [openMenuId,      setOpenMenuId]      = useState(null);
  const [menuPos,         setMenuPos]         = useState({ top: 0, right: 0 });
  const [pageTab,         setPageTab]         = useState('templates'); // 'templates' | 'mappings'
  const [statusFilter,    setStatusFilter]    = useState('ALL');
  const [search,          setSearch]          = useState('');
  const [selectedTag,     setSelectedTag]     = useState(null);

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

  const cloneMut = useMutation({
    mutationFn: (t) => cloneTemplate(t.id),
    onSuccess: (cloned) => {
      toast.success('Template cloned as draft');
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
      setEditingTemplate(cloned);
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Clone failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (t) => deleteTemplate(t.id),
    onSuccess: () => {
      toast.success('Template deleted');
      qc.invalidateQueries({ queryKey: ['wf-templates'] });
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Delete failed'),
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
        onClone={(t) => cloneMut.mutate(t)}
      />
    );
  }

  const STATUS_TABS = [
    { key: 'ALL',        label: 'All',        count: templates.length },
    { key: 'PUBLISHED',  label: 'Published',  count: templates.filter(t => t.status === 'PUBLISHED').length },
    { key: 'DRAFT',      label: 'Drafts',     count: templates.filter(t => t.status === 'DRAFT').length },
    { key: 'DEPRECATED', label: 'Deprecated', count: templates.filter(t => t.status === 'DEPRECATED').length },
  ];

  const allTags = [...new Set(templates.flatMap(t => t.tags || []))].sort();

  const filtered = templates
    .filter(t => statusFilter === 'ALL' || t.status === statusFilter)
    .filter(t => !selectedTag || (t.tags && t.tags.includes(selectedTag)))
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.name?.toLowerCase().includes(q)
        || t.processKey?.toLowerCase().includes(q)
        || t.description?.toLowerCase().includes(q)
        || (t.tags || []).some(tag => tag.toLowerCase().includes(q));
    });

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workflow Designer</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Design, publish, and manage BPMN 2.0 workflow templates
          </p>
        </div>
        {pageTab === 'templates' && (
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm">
            <Plus size={15} /> New Template
          </button>
        )}
      </div>

      {/* Page-level tabs: Templates | Category Mappings */}
      <div className="flex gap-0 border-b border-gray-200">
        {[
          { key: 'templates', label: 'Templates', icon: GitMerge },
          { key: 'mappings',  label: 'Category Mappings', icon: Link2 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setPageTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${pageTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ Templates Tab ═══ */}
      {pageTab === 'templates' && (
        <>
          {/* Status filter + Search */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-0 rounded-lg border border-gray-200 overflow-hidden">
              {STATUS_TABS.map(({ key, label, count }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors
                    ${statusFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                  <span className={`ml-1 text-[10px] ${statusFilter === key ? 'text-blue-200' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              />
            </div>
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Tags:</span>
              <button onClick={() => setSelectedTag(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                  ${!selectedTag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                All
              </button>
              {allTags.map((tag) => (
                <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                    ${selectedTag === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && templates.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <GitMerge size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No workflow templates yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first template to start designing</p>
              <button onClick={() => setShowNewModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Create Template
              </button>
            </div>
          )}

          {/* No results for current filter */}
          {!isLoading && templates.length > 0 && filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No templates match your filter.
            </div>
          )}

          {/* Table */}
          {!isLoading && filtered.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Process Key</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">SLA</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Ver</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((t) => (
                    <tr key={t.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      onDoubleClick={() => setEditingTemplate(t)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{t.name}</span>
                          {t.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">DEFAULT</span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{t.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500 truncate block max-w-[180px]">
                          {t.processKey || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status] ?? STATUS_BADGE.DRAFT}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[t.bpmnSource] ?? SOURCE_BADGE.DSL}`}>
                          {t.bpmnSource === 'VISUAL' ? 'Visual' : 'DSL'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.tags || []).map((tag) => (
                            <span key={tag}
                              onClick={(e) => { e.stopPropagation(); setSelectedTag(selectedTag === tag ? null : tag); }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-500">{t.slaHours ?? 48}h</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-400">{t.version ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === t.id) { setOpenMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            setOpenMenuId(t.id);
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {!isLoading && templates.length > 0 && (
            <div className="text-xs text-gray-400 text-right">
              Showing {filtered.length} of {templates.length} templates
            </div>
          )}
        </>
      )}

      {/* ═══ Category Mappings Tab ═══ */}
      {pageTab === 'mappings' && (
        <CategoryMappingsSection templates={templates} />
      )}

      {showNewModal && (
        <NewTemplateModal
          onCreated={handleTemplateCreated}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* ActionMenu rendered outside the overflow-hidden table container */}
      {openMenuId && (() => {
        const t = filtered.find(x => x.id === openMenuId);
        return t ? (
          <ActionMenu template={t} pos={menuPos}
            onEdit={setEditingTemplate}
            onPublish={publishMut.mutate}
            onDeprecate={deprecateMut.mutate}
            onClone={cloneMut.mutate}
            onDelete={deleteMut.mutate}
            onClose={() => setOpenMenuId(null)} />
        ) : null;
      })()}
    </div>
  );
}