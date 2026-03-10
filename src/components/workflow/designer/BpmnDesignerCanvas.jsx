/**
 * BpmnDesignerCanvas.jsx
 *
 * Custom bpmn-js designer with:
 *   - ECM-branded palette sidebar (replaces generic bpmn-js shapes)
 *   - Context-aware properties panel (right side)
 *   - Flowable attribute editing via $attrs (no moddleExtension required)
 *
 * Layout:
 *   [ ECM Palette 220px ] [ bpmn-js Canvas flex-1 ] [ Properties Panel 300px ]
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Loader2, ZoomIn, ZoomOut, Maximize2, Code, Download,
  AlertTriangle, ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { saveTemplateBpmn, getTemplateBpmnXml } from '../../../api/workflowApi';

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE ICONS — simple monochrome SVGs for the clean palette
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// ECM PALETTE CONFIGURATION
// Each item defines: bpmnType, dimensions, default flowable $attrs, display info
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES PANEL
// ─────────────────────────────────────────────────────────────────────────────

// ECM candidate groups available in dropdown
const CANDIDATE_GROUPS = [
  { value: 'ECM_REVIEWER',    label: 'Reviewer' },
  { value: 'ECM_BACKOFFICE',  label: 'Backoffice' },
  { value: 'ECM_UNDERWRITER', label: 'Underwriter' },
  { value: 'ECM_ADMIN',       label: 'Admin' },
  { value: '${candidateGroup}', label: 'Dynamic (process var)' },
  { value: 'CUSTOM',          label: 'Custom…' },
];

// Condition expressions for exclusive gateway outgoing flows
const DECISION_CONDITIONS = [
  { value: 'NONE',          label: 'No condition (always)' },
  { value: 'APPROVED',      label: 'APPROVED' },
  { value: 'REJECTED',      label: 'REJECTED' },
  { value: 'REQUEST_INFO',  label: 'REQUEST_INFO' },
  { value: 'PASS',          label: 'PASS (triage)' },
  { value: 'INFO_PROVIDED', label: 'INFO_PROVIDED' },
  { value: 'ESCALATE',      label: 'ESCALATE' },
  { value: 'CUSTOM',        label: 'Custom expression…' },
];

// ECM status options for end events
const ECM_STATUSES = [
  { value: 'COMPLETED',  label: 'Completed (approved)' },
  { value: 'REJECTED',   label: 'Rejected' },
  { value: 'CANCELLED',  label: 'Cancelled' },
];

// DocuSign service type options
const DOCUSIGN_DELEGATES = [
  { value: '${docuSignDelegate}',    label: 'DocuSign (live)' },
  { value: '${docuSignStubDelegate}', label: 'DocuSign Stub (dev/approve)' },
  { value: '${notificationDelegate}', label: 'Email Notification' },
  { value: 'CUSTOM',                  label: 'Custom class…' },
];

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400
        ${mono ? 'font-mono text-xs' : ''}`}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white
        focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Helper: read a flowable:X attribute from element
const getFlowAttr = (el, key) =>
  el?.businessObject?.$attrs?.[`flowable:${key}`] ?? '';

// Helper: write a flowable:X attribute via bpmn-js modeling
const setFlowAttr = (modeler, el, key, value) => {
  const modeling = modeler.get('modeling');
  const currentAttrs = el.businessObject.$attrs || {};
  modeling.updateProperties(el, {
    $attrs: { ...currentAttrs, [`flowable:${key}`]: value },
  });
};

// Helper: delete a flowable:X attribute
const delFlowAttr = (modeler, el, key) => {
  const modeling = modeler.get('modeling');
  const currentAttrs = { ...(el.businessObject.$attrs || {}) };
  delete currentAttrs[`flowable:${key}`];
  modeling.updateProperties(el, { $attrs: currentAttrs });
};

// Parse condition body to a known decision keyword or CUSTOM
function parseCondition(el) {
  const body = el?.businessObject?.conditionExpression?.body ?? '';
  if (!body) return 'NONE';
  for (const c of DECISION_CONDITIONS) {
    if (c.value !== 'NONE' && c.value !== 'CUSTOM' && body.includes(`'${c.value}'`)) return c.value;
  }
  return 'CUSTOM';
}

function buildConditionBody(decision) {
  return `\${decision == '${decision}'}`;
}

// ── START EVENT PROPERTIES ───────────────────────────────────────────────────
function StartEventProps({ el, modeler }) {
  const [name, setName] = useState(el.businessObject.name ?? '');
  const [initiator, setInitiator] = useState(getFlowAttr(el, 'initiator') || 'initiator');

  useEffect(() => {
    setName(el.businessObject.name ?? '');
    setInitiator(getFlowAttr(el, 'initiator') || 'initiator');
  }, [el]);

  const applyName = () => modeler.get('modeling').updateProperties(el, { name });
  const applyInitiator = () => setFlowAttr(modeler, el, 'initiator', initiator);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🟢</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">Start Event</div>
          <div className="text-xs text-slate-500">Workflow entry point</div>
        </div>
      </div>
      <Field label="Label">
        <Input value={name} onChange={setName} placeholder="Start" />
        <button onClick={applyName} className="mt-1 text-xs text-blue-600 hover:underline">Apply</button>
      </Field>
      <Field label="Initiator Variable"
        hint="Process variable that will hold the submitter's userId">
        <Input value={initiator} onChange={setInitiator} placeholder="initiator" mono />
        <button onClick={applyInitiator} className="mt-1 text-xs text-blue-600 hover:underline">Apply</button>
      </Field>
    </div>
  );
}

// ── USER TASK PROPERTIES ─────────────────────────────────────────────────────
function UserTaskProps({ el, modeler }) {
  const [name, setName]         = useState(el.businessObject.name ?? '');
  const [groupSel, setGroupSel] = useState('CUSTOM');
  const [groupRaw, setGroupRaw] = useState('');
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    const n = el.businessObject.name ?? '';
    const cg = getFlowAttr(el, 'candidateGroups');
    const ag = getFlowAttr(el, 'assignee');

    setName(n);
    setAssignee(ag);

    const known = CANDIDATE_GROUPS.find((g) => g.value === cg);
    if (cg && known) {
      setGroupSel(cg);
      setGroupRaw(cg);
    } else if (cg) {
      setGroupSel('CUSTOM');
      setGroupRaw(cg);
    } else {
      setGroupSel('CUSTOM');
      setGroupRaw('');
    }
  }, [el]);

  const apply = () => {
    modeler.get('modeling').updateProperties(el, { name });
    const finalGroup = groupSel === 'CUSTOM' ? groupRaw : groupSel;
    if (finalGroup) {
      setFlowAttr(modeler, el, 'candidateGroups', finalGroup);
      delFlowAttr(modeler, el, 'assignee');
    }
    if (assignee && !finalGroup) {
      setFlowAttr(modeler, el, 'assignee', assignee);
    }
    toast.success('Task updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">👤</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">User Task</div>
          <div className="text-xs text-slate-500">Human review / approval step</div>
        </div>
      </div>

      <Field label="Task Name">
        <Input value={name} onChange={setName} placeholder="e.g. Review Document" />
      </Field>

      <Field label="Candidate Group"
        hint="Which team can claim this task from the queue">
        <Select
          value={groupSel}
          onChange={(v) => { setGroupSel(v); if (v !== 'CUSTOM') setGroupRaw(v); }}
          options={CANDIDATE_GROUPS}
        />
        {groupSel === 'CUSTOM' && (
          <Input
            value={groupRaw}
            onChange={setGroupRaw}
            placeholder="e.g. ECM_REVIEWER or group:42"
            mono
          />
        )}
      </Field>

      <Field label="Assignee Override"
        hint="Leave blank to use Candidate Group pool. Use ${initiator} for submitter.">
        <Input value={assignee} onChange={setAssignee}
          placeholder="${initiator} or specific userId" mono />
      </Field>

      <button
        onClick={apply}
        className="w-full rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700"
      >
        Apply Changes
      </button>

      <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-500 break-all">
        flowable:candidateGroups="{groupSel === 'CUSTOM' ? groupRaw : groupSel}"
      </div>
    </div>
  );
}

// ── SERVICE TASK PROPERTIES ──────────────────────────────────────────────────
function ServiceTaskProps({ el, modeler }) {
  const [name, setName]           = useState(el.businessObject.name ?? '');
  const [delegateSel, setDelegateSel] = useState('CUSTOM');
  const [delegateRaw, setDelegateRaw] = useState('');
  // DocuSign-specific fields
  const [dsSubject, setDsSubject] = useState('');
  const [dsEmailVar, setDsEmailVar] = useState('submitterEmail');

  useEffect(() => {
    setName(el.businessObject.name ?? '');
    const de = getFlowAttr(el, 'delegateExpression');
    const known = DOCUSIGN_DELEGATES.find((d) => d.value === de);
    if (de && known) { setDelegateSel(de); setDelegateRaw(de); }
    else if (de) { setDelegateSel('CUSTOM'); setDelegateRaw(de); }
    else { setDelegateSel('CUSTOM'); setDelegateRaw(''); }
    setDsSubject(getFlowAttr(el, 'docusignSubjectTemplate') || '');
    setDsEmailVar(getFlowAttr(el, 'docusignRecipientEmailVar') || 'submitterEmail');
  }, [el]);

  const isDocuSign = delegateSel === '${docuSignDelegate}' ||
    delegateSel === '${docuSignStubDelegate}' ||
    delegateRaw.includes('docuSign');

  const apply = () => {
    modeler.get('modeling').updateProperties(el, { name });
    const finalDelegate = delegateSel === 'CUSTOM' ? delegateRaw : delegateSel;
    if (finalDelegate) setFlowAttr(modeler, el, 'delegateExpression', finalDelegate);
    if (isDocuSign) {
      if (dsSubject) setFlowAttr(modeler, el, 'docusignSubjectTemplate', dsSubject);
      if (dsEmailVar) setFlowAttr(modeler, el, 'docusignRecipientEmailVar', dsEmailVar);
    }
    toast.success('Service task updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚙️</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">Service Task</div>
          <div className="text-xs text-slate-500">Automated step (DocuSign, Email…)</div>
        </div>
      </div>

      <Field label="Task Name">
        <Input value={name} onChange={setName} placeholder="e.g. Send to DocuSign" />
      </Field>

      <Field label="Service Type"
        hint="Maps to a Java delegate bean in ecm-workflow">
        <Select
          value={delegateSel}
          onChange={(v) => { setDelegateSel(v); if (v !== 'CUSTOM') setDelegateRaw(v); }}
          options={DOCUSIGN_DELEGATES}
        />
        {delegateSel === 'CUSTOM' && (
          <Input value={delegateRaw} onChange={setDelegateRaw}
            placeholder="${myDelegate}" mono />
        )}
      </Field>

      {isDocuSign && (
        <>
          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">
              DocuSign Config
            </div>
            <div className="space-y-3">
              <Field label="Email Subject Template"
                hint="Use {documentName} for dynamic value">
                <Input value={dsSubject} onChange={setDsSubject}
                  placeholder="Please sign: {documentName}" />
              </Field>
              <Field label="Recipient Email Variable"
                hint="Process variable holding recipient's email">
                <Input value={dsEmailVar} onChange={setDsEmailVar}
                  placeholder="submitterEmail" mono />
              </Field>
            </div>
          </div>
        </>
      )}

      <button
        onClick={apply}
        className="w-full rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700"
      >
        Apply Changes
      </button>

      <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-500 break-all">
        flowable:delegateExpression="{delegateSel === 'CUSTOM' ? delegateRaw : delegateSel}"
      </div>
    </div>
  );
}

// ── GATEWAY PROPERTIES ───────────────────────────────────────────────────────
function GatewayProps({ el, modeler }) {
  const isExclusive = el.type === 'bpmn:ExclusiveGateway';
  const [name, setName] = useState(el.businessObject.name ?? '');

  useEffect(() => setName(el.businessObject.name ?? ''), [el]);

  const apply = () => modeler.get('modeling').updateProperties(el, { name });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{isExclusive ? '◇' : '◈'}</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">
            {isExclusive ? 'Exclusive Gateway (Decision)' : 'Parallel Gateway'}
          </div>
          <div className="text-xs text-slate-500">
            {isExclusive
              ? 'Routes based on the `decision` process variable'
              : 'Forks / joins parallel branches'}
          </div>
        </div>
      </div>

      <Field label="Label">
        <Input value={name} onChange={setName} placeholder={isExclusive ? 'Decision' : 'Parallel'} />
        <button onClick={apply} className="mt-1 text-xs text-blue-600 hover:underline">Apply</button>
      </Field>

      {isExclusive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
          <strong>Tip:</strong> Click each outgoing arrow (sequence flow) from this gateway
          to set the condition: APPROVED, REJECTED, REQUEST_INFO, PASS, etc.
        </div>
      )}
    </div>
  );
}

// ── SEQUENCE FLOW PROPERTIES ─────────────────────────────────────────────────
function SequenceFlowProps({ el, modeler }) {
  const sourceType = el.businessObject.sourceRef?.$type ?? '';
  const isFromGateway = sourceType === 'bpmn:ExclusiveGateway';

  const [name, setName]       = useState(el.businessObject.name ?? '');
  const [condition, setCondition] = useState(parseCondition(el));
  const [customExpr, setCustomExpr] = useState(
    el.businessObject.conditionExpression?.body ?? ''
  );

  useEffect(() => {
    setName(el.businessObject.name ?? '');
    const parsed = parseCondition(el);
    setCondition(parsed);
    if (parsed === 'CUSTOM') setCustomExpr(el.businessObject.conditionExpression?.body ?? '');
  }, [el]);

  const apply = () => {
    const modeling = modeler.get('modeling');
    const moddle   = modeler.get('moddle');

    modeling.updateProperties(el, { name });

    if (isFromGateway) {
      if (condition === 'NONE') {
        modeling.updateProperties(el, { conditionExpression: undefined });
      } else {
        const body = condition === 'CUSTOM'
          ? customExpr
          : buildConditionBody(condition);
        const expr = moddle.create('bpmn:FormalExpression', { body });
        modeling.updateProperties(el, { conditionExpression: expr });
      }
    }
    toast.success('Flow updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">→</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">Sequence Flow</div>
          <div className="text-xs text-slate-500">
            {isFromGateway ? 'Outgoing from Decision gateway' : 'Connects two elements'}
          </div>
        </div>
      </div>

      <Field label="Flow Label">
        <Input value={name} onChange={setName} placeholder="e.g. Approved path" />
      </Field>

      {isFromGateway && (
        <Field label="Condition (decision variable)"
          hint='Flowable evaluates ${decision == "..."} to route here'>
          <Select value={condition} onChange={setCondition} options={DECISION_CONDITIONS} />
          {condition === 'CUSTOM' && (
            <Input value={customExpr} onChange={setCustomExpr}
              placeholder="${myVar == 'VALUE'}" mono />
          )}
        </Field>
      )}

      <button
        onClick={apply}
        className="w-full rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700"
      >
        Apply Changes
      </button>

      {isFromGateway && condition !== 'NONE' && (
        <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono text-slate-500 break-all">
          {condition === 'CUSTOM' ? customExpr : buildConditionBody(condition)}
        </div>
      )}
    </div>
  );
}

// ── END EVENT PROPERTIES ─────────────────────────────────────────────────────
function EndEventProps({ el, modeler }) {
  const [name, setName]   = useState(el.businessObject.name ?? '');
  const [status, setStatus] = useState(
    el.businessObject.$attrs?.['ecm:status'] ?? 'COMPLETED'
  );

  useEffect(() => {
    setName(el.businessObject.name ?? '');
    setStatus(el.businessObject.$attrs?.['ecm:status'] ?? 'COMPLETED');
  }, [el]);

  const isApproved = name.toLowerCase().includes('approv') || status === 'COMPLETED';

  const apply = () => {
    modeler.get('modeling').updateProperties(el, { name });
    const currentAttrs = el.businessObject.$attrs || {};
    modeler.get('modeling').updateProperties(el, {
      $attrs: { ...currentAttrs, 'ecm:status': status },
    });
    toast.success('End event updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{isApproved ? '🟢' : '🔴'}</span>
        <div>
          <div className="font-bold text-slate-800 text-sm">End Event</div>
          <div className="text-xs text-slate-500">Terminal state for the workflow</div>
        </div>
      </div>

      <Field label="Event Name">
        <Input value={name} onChange={setName} placeholder="e.g. Approved / Rejected" />
      </Field>

      <Field label="ECM Completion Status"
        hint="Maps to WorkflowInstanceRecord.Status on process end">
        <Select value={status} onChange={setStatus} options={ECM_STATUSES} />
      </Field>

      <button
        onClick={apply}
        className="w-full rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700"
      >
        Apply Changes
      </button>
    </div>
  );
}

// ── PROPERTIES PANEL ROUTER ──────────────────────────────────────────────────
function EcmPropertiesPanel({ selectedElement, modelerRef }) {
  if (!selectedElement) {
    return (
      <aside
        className="flex flex-col items-center justify-center bg-slate-50 border-l border-slate-200 flex-shrink-0 p-4"
        style={{ width: 300 }}
      >
        <div className="text-center space-y-2">
          <div className="text-3xl opacity-30">🖱️</div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            No Selection
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Click any shape on the canvas to configure its Flowable properties
          </div>
        </div>
        <div className="mt-8 w-full space-y-2">
          {[
            ['👤 User Task', 'Set candidateGroups'],
            ['⚙️ Service Task', 'Set delegateExpression'],
            ['→ Sequence Flow', 'Set decision condition'],
          ].map(([type, hint]) => (
            <div key={type} className="flex items-center gap-2 text-xs text-slate-400 bg-white rounded-lg p-2 border border-slate-100">
              <span>{type}</span>
              <span className="text-slate-300 ml-auto">{hint}</span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const modeler = modelerRef.current;
  const type = selectedElement.type;

  const renderProps = () => {
    if (type === 'bpmn:StartEvent')
      return <StartEventProps el={selectedElement} modeler={modeler} />;
    if (type === 'bpmn:UserTask')
      return <UserTaskProps el={selectedElement} modeler={modeler} />;
    if (type === 'bpmn:ServiceTask')
      return <ServiceTaskProps el={selectedElement} modeler={modeler} />;
    if (type === 'bpmn:ExclusiveGateway' || type === 'bpmn:ParallelGateway')
      return <GatewayProps el={selectedElement} modeler={modeler} />;
    if (type === 'bpmn:SequenceFlow')
      return <SequenceFlowProps el={selectedElement} modeler={modeler} />;
    if (type === 'bpmn:EndEvent')
      return <EndEventProps el={selectedElement} modeler={modeler} />;
    return (
      <div className="text-xs text-slate-400 text-center pt-8">
        No properties available for <code>{type}</code>
      </div>
    );
  };

  return (
    <aside
      className="flex flex-col bg-white border-l border-slate-200 flex-shrink-0 overflow-y-auto"
      style={{ width: 300 }}
    >
      <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <div className="text-xs font-black tracking-widest text-slate-400 uppercase">
          Properties
        </div>
        <div className="text-xs text-slate-400 mt-0.5 font-mono">{type?.replace('bpmn:', '')}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderProps()}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CANVAS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BpmnDesignerCanvas({ templateId, onSaved }) {
  const containerRef = useRef(null);
  const modelerRef   = useRef(null);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [xmlView,    setXmlView]    = useState(false);
  const [rawXml,     setRawXml]     = useState('');
  const [error,      setError]      = useState(null);
  const [selected,   setSelected]   = useState(null);


  // ── Mount bpmn-js modeler ────────────────────────────────────────────────
  useEffect(() => {
    let modeler;

    async function init() {
      try {
        const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');

        modeler = new BpmnModeler({ container: containerRef.current });
        modelerRef.current = modeler;

        // Load existing BPMN from backend
        const xml = await getTemplateBpmnXml(templateId);
        await modeler.importXML(xml);
        modeler.get('canvas').zoom('fit-viewport', 'auto');

        // ── Selection listener ─────────────────────────────────────────────
        modeler.get('eventBus').on('selection.changed', ({ newSelection }) => {
          setSelected(newSelection?.[0] ?? null);
        });

        // bpmn-js built-in palette is used — no custom palette

        setLoading(false);
      } catch (err) {
        console.error('BPMN init error:', err);
        setError(err.message ?? 'Failed to load designer');
        setLoading(false);
      }
    }

    init();
    return () => { modeler?.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!modelerRef.current) return;
    setSaving(true);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      await saveTemplateBpmn(templateId, xml);
      toast.success('BPMN saved — ready to publish');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [templateId, onSaved]);

  // ── XML view toggle ───────────────────────────────────────────────────────
  const handleToggleXml = useCallback(async () => {
    if (!xmlView && modelerRef.current) {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      setRawXml(xml);
    }
    setXmlView((v) => !v);
  }, [xmlView]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!modelerRef.current) return;
    const { xml } = await modelerRef.current.saveXML({ format: true });
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `workflow-${templateId}.bpmn`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [templateId]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const zoom = useCallback((dir) => {
    const canvas = modelerRef.current?.get('canvas');
    if (!canvas) return;
    const z = canvas.zoom();
    canvas.zoom(dir === 'in' ? z * 1.2 : z / 1.2);
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-500 p-8">
        <AlertTriangle size={32} />
        <p className="font-semibold">Failed to load designer</p>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => zoom('in')} title="Zoom in"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ZoomIn size={15} /></button>
          <button onClick={() => zoom('out')} title="Zoom out"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ZoomOut size={15} /></button>
          <button onClick={() => modelerRef.current?.get('canvas').zoom('fit-viewport', 'auto')}
            title="Fit to view" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <Maximize2 size={15} /></button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={handleToggleXml}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
              ${xmlView ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Code size={13} /> XML
          </button>
          <button onClick={handleDownload} title="Download BPMN"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Download size={15} /></button>
        </div>
        <button onClick={handleSave} disabled={saving || loading}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save BPMN
        </button>
      </div>

      {/* ── Body: bpmn-js Canvas (with built-in palette) | Properties ────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Canvas — bpmn-js renders its own palette on the left */}
        <div className="flex-1 relative min-w-0">
          {xmlView ? (
            <div className="absolute inset-0 overflow-auto bg-gray-950 p-4">
              <pre className="text-xs text-green-300 font-mono whitespace-pre leading-relaxed">{rawXml}</pre>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-50">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                  <span className="ml-3 text-sm text-gray-400">Loading designer…</span>
                </div>
              )}
              <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              />
            </>
          )}
        </div>

        {/* ECM Properties Panel */}
        <EcmPropertiesPanel selectedElement={selected} modelerRef={modelerRef} />
      </div>
    </div>
  );
}