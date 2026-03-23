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
  AlertTriangle, ChevronDown, ChevronRight, Info, Eye, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { saveTemplateBpmn, getTemplateBpmnXml, getTemplate } from '../../../api/workflowApi';

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

function Input({ value, onChange, placeholder, mono, onBlur }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
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

// ─────────────────────────────────────────────────────────────────────────────
// Auto-apply hook: debounces property changes (500ms) so rapid keystrokes
// become a single commandStack entry. This makes Ctrl+Z undo meaningful
// (undo a whole name change, not individual characters).
//
// Returns a flush() function that callers (save, XML view) can use to
// ensure pending changes are applied before exporting.
// ─────────────────────────────────────────────────────────────────────────────
const pendingFlushes = new Set();

function useAutoApply(el, modeler, buildProps, deps) {
  const ready = useRef(false);
  const timerRef = useRef(null);
  const buildPropsRef = useRef(buildProps);
  buildPropsRef.current = buildProps;

  // Block auto-apply for 100ms after element selection (skip initial state load)
  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => { ready.current = true; }, 100);
    return () => clearTimeout(timer);
  }, [el]);

  useEffect(() => {
    if (!ready.current || !el || !modeler) return;

    // Clear previous pending timer
    if (timerRef.current) clearTimeout(timerRef.current);

    const apply = () => {
      timerRef.current = null;
      pendingFlushes.delete(apply);
      try {
        const props = buildPropsRef.current();
        if (props) {
          modeler.get('modeling').updateProperties(el, props);
        }
      } catch (e) {
        console.warn('[BpmnDesigner] Auto-apply failed:', e.message);
      }
    };

    // Register for flush-before-save
    pendingFlushes.add(apply);
    timerRef.current = setTimeout(apply, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingFlushes.delete(apply);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Flush all pending auto-apply timers immediately (call before save/XML export)
function flushPendingApplies() {
  pendingFlushes.forEach(fn => fn());
  pendingFlushes.clear();
}

// ── START EVENT PROPERTIES ───────────────────────────────────────────────────
function StartEventProps({ el, modeler }) {
  const [name, setName] = useState(el.businessObject.name ?? '');
  const [initiator, setInitiator] = useState(getFlowAttr(el, 'initiator') || 'initiator');

  useEffect(() => {
    setName(el.businessObject.name ?? '');
    setInitiator(getFlowAttr(el, 'initiator') || 'initiator');
  }, [el]);

  useAutoApply(el, modeler, () => ({
    name,
    'flowable:initiator': initiator,
  }), [name, initiator]);

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
      </Field>
      <Field label="Initiator Variable"
        hint="Process variable that will hold the submitter's userId">
        <Input value={initiator} onChange={setInitiator} placeholder="initiator" mono />
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

  useAutoApply(el, modeler, () => {
    const finalGroup = groupSel === 'CUSTOM' ? groupRaw : groupSel;
    const props = { name };

    if (finalGroup) {
      props['flowable:candidateGroups'] = finalGroup;
      props['flowable:assignee'] = undefined;
    } else if (assignee) {
      props['flowable:assignee'] = assignee;
    }

    return props;
  }, [name, groupSel, groupRaw, assignee]);

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

  useAutoApply(el, modeler, () => {
    const finalDelegate = delegateSel === 'CUSTOM' ? delegateRaw : delegateSel;
    const props = { name };
    if (finalDelegate) props['flowable:delegateExpression'] = finalDelegate;
    if (isDocuSign) {
      if (dsSubject) props['flowable:docusignSubjectTemplate'] = dsSubject;
      if (dsEmailVar) props['flowable:docusignRecipientEmailVar'] = dsEmailVar;
    }
    return props;
  }, [name, delegateSel, delegateRaw, dsSubject, dsEmailVar]);

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

  useAutoApply(el, modeler, () => ({ name }), [name]);

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

  useAutoApply(el, modeler, () => {
    const moddle = modeler.get('moddle');
    const props = { name };
    if (isFromGateway) {
      if (condition === 'NONE') {
        props.conditionExpression = undefined;
      } else {
        const body = condition === 'CUSTOM'
          ? customExpr
          : buildConditionBody(condition);
        props.conditionExpression = moddle.create('bpmn:FormalExpression', { body });
      }
    }
    return props;
  }, [name, condition, customExpr]);

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

  useAutoApply(el, modeler, () => ({
    name,
    'ecm:status': status,
  }), [name, status]);

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
            Click any shape on the canvas to configure its properties
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
        <div className="mt-6 text-xs text-slate-400 leading-relaxed text-center">
          Properties are saved automatically as you edit.
          <br />Click <strong>Save Workflow</strong> to persist to backend.
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
      <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400 text-center">
        Changes apply automatically to the canvas
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CANVAS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BpmnDesignerCanvas({ templateId, onSaved, readOnly = false }) {
  const containerRef = useRef(null);
  const modelerRef   = useRef(null);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [xmlView,    setXmlView]    = useState(false);
  const [rawXml,     setRawXml]     = useState('');
  const [error,      setError]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [dirty,      setDirty]      = useState(false);
  const [xmlEdited,  setXmlEdited]  = useState(false);


  // ── Mount bpmn-js modeler ────────────────────────────────────────────────
  // NOTE: init() is async, so React StrictMode cleanup may run before it
  // completes. We use `cancelled` flag to abort stale init calls.
  useEffect(() => {
    let cancelled = false;
    let modelerInstance = null;

    async function init() {
      try {
        const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');

        // If cleanup already ran (StrictMode), abort this stale init
        if (cancelled) return;

        modelerInstance = new BpmnModeler({ container: containerRef.current });
        modelerRef.current = modelerInstance;

        const eventBus = modelerInstance.get('eventBus');

        // Handle diagram-js errors at the EventBus level to prevent
        // CommandStack rollback on known rendering errors
        eventBus.on('error', function(e) {
          const msg = e?.error?.message || '';
          if (msg.includes('parentNode') || msg.includes('getPad')) {
            console.warn('[BpmnDesigner] Suppressed diagram-js error:', msg);
            return false;
          }
        });

        // Patch updateContainments for extra safety
        const gfxFactory = modelerInstance.get('graphicsFactory');
        const origUpdateContainments = gfxFactory.updateContainments.bind(gfxFactory);
        gfxFactory.updateContainments = function(elements) {
          try {
            origUpdateContainments(elements);
          } catch (e) {
            if (e?.message?.includes('parentNode')) {
              // Silently ignore — graphics will sync on next render cycle
            } else {
              throw e;
            }
          }
        };

        // Load existing BPMN from backend
        const tmpl = await getTemplate(templateId);
        if (cancelled) { modelerInstance.destroy(); return; }

        const xml = tmpl?.bpmnXml || await getTemplateBpmnXml(templateId);
        if (cancelled) { modelerInstance.destroy(); return; }

        console.log('[BpmnDesigner] Loaded:', tmpl?.bpmnSource, xml?.length, 'chars');
        await modelerInstance.importXML(xml);
        if (cancelled) { modelerInstance.destroy(); return; }

        modelerInstance.get('canvas').zoom('fit-viewport', 'auto');

        // ── Selection listener ─────────────────────────────────────────────
        eventBus.on('selection.changed', ({ newSelection }) => {
          setSelected(newSelection?.[0] ?? null);
        });

        // Track changes to show dirty indicator
        eventBus.on('commandStack.changed', () => {
          setDirty(true);
        });

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('BPMN init error:', err);
        setError(err.message ?? 'Failed to load designer');
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      modelerInstance?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!modelerRef.current) return;
    setSaving(true);
    try {
      // Flush any pending debounced property changes before exporting
      flushPendingApplies();

      const { xml } = await modelerRef.current.saveXML({ format: true });
      await saveTemplateBpmn(templateId, xml);

      toast.success('Workflow saved');
      setDirty(false);
      onSaved?.();
    } catch (err) {
      console.error('[BpmnDesigner] Save failed:', err);
      toast.error(err.response?.data?.message ?? err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [templateId, onSaved]);

  // ── XML view toggle ───────────────────────────────────────────────────────
  const handleToggleXml = useCallback(async () => {
    if (!xmlView && modelerRef.current) {
      // Flush pending property changes, then capture current modeler state
      flushPendingApplies();
      const { xml } = await modelerRef.current.saveXML({ format: true });
      setRawXml(xml);
      setXmlEdited(false);
    } else if (xmlView && modelerRef.current) {
      // Switching BACK to visual
      if (xmlEdited) {
        // Only re-import if user actually edited the XML in the textarea
        try {
          await modelerRef.current.importXML(rawXml);
          requestAnimationFrame(() => {
            try {
              modelerRef.current?.get('canvas').zoom('fit-viewport', 'auto');
            } catch (_) { /* ignore zoom errors on resize */ }
          });
          setDirty(true);
        } catch (err) {
          toast.error('Invalid BPMN XML: ' + (err.message || 'parse error'));
          return; // Stay in XML view so user can fix
        }
      }
      // If not edited, canvas already has the correct state — just hide XML overlay
    }
    setXmlView((v) => !v);
  }, [xmlView, rawXml, xmlEdited]);

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
          {!xmlView && (
            <>
              <button onClick={() => zoom('in')} title="Zoom in"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ZoomIn size={15} /></button>
              <button onClick={() => zoom('out')} title="Zoom out"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ZoomOut size={15} /></button>
              <button onClick={() => modelerRef.current?.get('canvas').zoom('fit-viewport', 'auto')}
                title="Fit to view" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <Maximize2 size={15} /></button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
            </>
          )}
          <button onClick={handleToggleXml}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
              ${xmlView ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
            {xmlView ? <><Eye size={13} /> Visual</> : <><Code size={13} /> XML</>}
          </button>
          {!xmlView && (
            <button onClick={handleDownload} title="Download BPMN"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Download size={15} /></button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && dirty && (
            <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
          )}
          {!readOnly && (
            <button onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save Workflow
            </button>
          )}
        </div>
      </div>

      {/* ── Body: bpmn-js Canvas (with built-in palette) | Properties ────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Canvas — ALWAYS mounted to preserve modeler container reference */}
        <div className="flex-1 relative min-w-0">
          {/* XML editor overlay — shown on top of canvas */}
          {xmlView && (
            <div className="absolute inset-0 z-20 flex flex-col bg-gray-950">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
                <span className="text-xs text-gray-400 font-mono">BPMN 2.0 XML</span>
                <span className="text-xs text-gray-500">Edit XML below, then click "Visual" to apply changes</span>
              </div>
              <textarea
                value={rawXml}
                onChange={(e) => { setRawXml(e.target.value); setXmlEdited(true); setDirty(true); }}
                spellCheck={false}
                className="flex-1 w-full bg-gray-950 text-green-300 text-xs font-mono p-4 resize-none
                  focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {/* bpmn-js canvas — always in DOM, hidden behind XML overlay when needed */}
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
        </div>

        {/* ECM Properties Panel — hidden in XML view */}
        {!xmlView && (
          <EcmPropertiesPanel selectedElement={selected} modelerRef={modelerRef} />
        )}
      </div>
    </div>
  );
}
