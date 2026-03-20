/**
 * FormSettingsPanel.jsx
 * Form-level settings: name, key, productType, formType, layout, tags, workflow.
 * Shown when activePanel === 'settings' in the designer toolbar.
 *
 * Sprint-C addition: "Workflow" section.
 *   - Fetches published workflow definitions via useWorkflowDefinitions()
 *   - Dropdown: select a workflow by name; writes processKey → meta.workflowKey
 *   - Selecting a workflow auto-fills assignToRole and slaDays from the definition
 *     (the user can override both after selection)
 *   - Toggle: triggerOnSubmit (default on)
 *   - Priority dropdown: LOW | NORMAL | HIGH | URGENT
 *   - Clearing the workflow dropdown sets workflowKey = '' (no workflow attached)
 */
import { useEFormsDesignerStore } from '../../../store/eformsStore';
import { useWorkflowDefinitions } from '../../../hooks/useWorkflow';
import { useCategories } from '../../../hooks/useAdmin';
import { Loader2, AlertCircle, Zap, ZapOff } from 'lucide-react';

// ─── Static option lists ──────────────────────────────────────────────────────

const LAYOUTS = [
  { value: 'SINGLE_PAGE',  label: 'Single Page' },
  { value: 'MULTI_PAGE',   label: 'Multi Page (Wizard)' },
  { value: 'ACCORDION',    label: 'Accordion' },
];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const ROLES = [
  { value: '',               label: 'Use workflow default' },
  { value: 'ECM_REVIEWER',   label: 'Reviewer' },
  { value: 'ECM_BACKOFFICE', label: 'Back Office' },
  { value: 'ECM_ADMIN',      label: 'Admin' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function FormSettingsPanel() {
  const { meta, schema, updateMeta, updateSchemaSettings } = useEFormsDesignerStore();

  // Fetch all active workflow definitions from ecm-workflow
  // Returns WorkflowDefinitionDto[]: { id, name, processKey, assignedRole, slaHours, active }
  const {
    data: workflowDefs = [],
    isLoading: wfLoading,
    isError: wfError,
  } = useWorkflowDefinitions();

  const { data: categories = [] } = useCategories(true);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleTagInput = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/,$/, '');
      if (val && !meta.tags.includes(val)) {
        updateMeta({ tags: [...meta.tags, val] });
      }
      e.target.value = '';
    }
  };

  const removeTag = (tag) =>
    updateMeta({ tags: meta.tags.filter((t) => t !== tag) });

  /**
   * When the user picks a workflow from the dropdown:
   *   1. Write processKey → meta.workflowKey  (what the backend stores)
   *   2. Auto-fill assignToRole + slaDays from the definition's defaults
   *      so the user sees sensible pre-filled values (they can override them)
   *   3. Clearing the dropdown ('') removes the workflow linkage entirely.
   */
  const handleWorkflowSelect = (processKey) => {
    if (!processKey) {
      updateMeta({ workflowKey: '', assignToRole: '', slaDays: 5 });
      return;
    }
    const chosen = workflowDefs.find((d) => d.processKey === processKey);
    updateMeta({
      workflowKey:  processKey,
      // Convert slaHours → slaDays (backend stores hours; UI shows days)
      slaDays:      chosen?.slaHours ? Math.ceil(chosen.slaHours / 24) : meta.slaDays,
      // Only auto-fill role if the user hasn't manually set one already
      assignToRole: chosen?.assignedRole || meta.assignToRole || '',
    });
  };

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-700">Form Settings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <Section title="Identity">
          <Field label="Form Name *">
            <input
              type="text"
              value={meta.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              className={inputCls}
              placeholder="e.g. Mortgage Application"
            />
          </Field>
          <Field label="Form Key" hint="URL-safe, auto-generated if blank">
            <input
              type="text"
              value={meta.formKey}
              onChange={(e) =>
                updateMeta({ formKey: e.target.value.replace(/\s+/g, '-').toLowerCase() })
              }
              className={`${inputCls} font-mono`}
              placeholder="mortgage-application"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={meta.description}
              onChange={(e) => updateMeta({ description: e.target.value })}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Short description..."
            />
          </Field>
          <Field label="Document Category" hint="determines OCR template for approved documents">
            <select
              value={meta.documentCategoryId ?? ''}
              onChange={(e) => updateMeta({ documentCategoryId: e.target.value ? Number(e.target.value) : null })}
              className={inputCls}
            >
              <option value="">— No category —</option>
              {(Array.isArray(categories) ? categories : []).filter(c => c.isActive !== false).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </Field>
        </Section>

        {/* ── Tags ──────────────────────────────────────────────────────── */}
        <Section title="Tags">
          <Field label="Tags">
            <div className="flex flex-wrap gap-1 mb-1">
              {meta.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className={inputCls}
              placeholder="Type tag, press Enter"
              onKeyDown={handleTagInput}
            />
          </Field>
        </Section>

        {/* ── Layout & Behaviour ────────────────────────────────────────── */}
        <Section title="Layout & Behaviour">
          <Field label="Layout">
            <select
              value={schema.layout}
              onChange={(e) => updateSchemaSettings({ layout: e.target.value })}
              className={inputCls}
            >
              {LAYOUTS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Submit Button Label">
            <input
              type="text"
              value={schema.submitButtonLabel || 'Submit'}
              onChange={(e) => updateSchemaSettings({ submitButtonLabel: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Toggle
            label="Allow Save Draft"
            checked={schema.allowSaveDraft}
            onChange={(v) => updateSchemaSettings({ allowSaveDraft: v })}
          />
          <Toggle
            label="Confirm on Submit"
            checked={schema.confirmOnSubmit}
            onChange={(v) => updateSchemaSettings({ confirmOnSubmit: v })}
          />
        </Section>

        {/* ── Workflow ──────────────────────────────────────────────────── */}
        <Section title="Workflow">

          {/* Trigger toggle — at the top so it's obvious this whole section
              is optional. When off, the workflow dropdown is dimmed. */}
          <Toggle
            label="Trigger workflow on submit"
            checked={meta.triggerOnSubmit}
            onChange={(v) => updateMeta({ triggerOnSubmit: v })}
          />

          {/* Workflow definition dropdown */}
          <Field
            label="Workflow"
            hint={meta.triggerOnSubmit ? undefined : 'disabled — toggle on above'}
          >
            {wfLoading ? (
              /* Loading state — show spinner inside a disabled select-like box */
              <div className={`${inputCls} flex items-center gap-2 text-gray-400 cursor-not-allowed`}>
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
                <span>Loading workflows…</span>
              </div>
            ) : wfError ? (
              /* Error state — ecm-workflow service unreachable */
              <div className={`${inputCls} flex items-center gap-2 text-red-500 bg-red-50`}>
                <AlertCircle size={12} className="flex-shrink-0" />
                <span>Could not load workflows</span>
              </div>
            ) : (
              <select
                value={meta.workflowKey}
                onChange={(e) => handleWorkflowSelect(e.target.value)}
                disabled={!meta.triggerOnSubmit}
                className={`${inputCls} ${!meta.triggerOnSubmit ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <option value="">— No workflow —</option>
                {workflowDefs.map((def) => (
                  <option key={def.processKey} value={def.processKey}>
                    {def.name}
                  </option>
                ))}
              </select>
            )}

            {/* Show processKey below the dropdown so designers can cross-reference BPMN */}
            {meta.workflowKey && (
              <p className="mt-1 font-mono text-[10px] text-gray-400 truncate">
                key: {meta.workflowKey}
              </p>
            )}
          </Field>

          {/* ── Fields below only matter when a workflow is linked ─────── */}
          {meta.workflowKey && meta.triggerOnSubmit && (
            <>
              {/* Assign-to role — overrides the workflow's default assignee */}
              <Field
                label="Assign To Role"
                hint="overrides workflow default"
              >
                <select
                  value={meta.assignToRole}
                  onChange={(e) => updateMeta({ assignToRole: e.target.value })}
                  className={inputCls}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              {/* Priority */}
              <Field label="Priority">
                <div className="flex gap-1.5 flex-wrap">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => updateMeta({ priority: p })}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        meta.priority === p
                          ? priorityActiveCls(p)
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>

              {/* SLA days */}
              <Field
                label="SLA (days)"
                hint="calendar days from submission"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={meta.slaDays}
                    onChange={(e) =>
                      updateMeta({ slaDays: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                    className={`${inputCls} w-24`}
                  />
                  <span className="text-xs text-gray-400">days</span>
                </div>
              </Field>

              {/* Summary chip — what the submitter will trigger */}
              <WorkflowSummaryChip
                workflowDefs={workflowDefs}
                meta={meta}
              />
            </>
          )}

          {/* Explanation when no workflow is linked */}
          {(!meta.workflowKey || !meta.triggerOnSubmit) && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-dashed border-gray-200">
              <ZapOff size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                No workflow linked. Submissions will be stored but no review task
                will be created. Enable the toggle above and select a workflow to
                route submissions to a reviewer.
              </p>
            </div>
          )}
        </Section>

      </div>
    </aside>
  );
}

// ─── WorkflowSummaryChip ──────────────────────────────────────────────────────
// Shows a compact read-only summary of the current workflow configuration
// so the designer can confirm what will happen at submission time.

function WorkflowSummaryChip({ workflowDefs, meta }) {
  const def = workflowDefs.find((d) => d.processKey === meta.workflowKey);
  if (!def) return null;

  const roleLabel =
    meta.assignToRole
      ? ROLES.find((r) => r.value === meta.assignToRole)?.label ?? meta.assignToRole
      : def.assignedGroupName || 'workflow default';

  return (
    <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Zap size={11} className="text-indigo-500 flex-shrink-0" />
        <p className="text-[11px] font-semibold text-indigo-700">On submit:</p>
      </div>
      <ul className="space-y-0.5 pl-1">
        <SummaryRow label="Workflow" value={def.name} />
        <SummaryRow label="Reviewer" value={roleLabel} />
        <SummaryRow label="Priority" value={meta.priority} />
        <SummaryRow label="SLA"      value={`${meta.slaDays} days`} />
      </ul>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <li className="flex items-baseline gap-1.5">
      <span className="text-[10px] text-indigo-400 w-14 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-indigo-800 font-medium truncate">{value}</span>
    </li>
  );
}

// ─── Shared helper components ─────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {hint && (
          <span className="text-gray-400 font-normal ml-1 text-xs">({hint})</span>
        )}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function priorityActiveCls(p) {
  switch (p) {
    case 'URGENT': return 'bg-red-500    text-white border-red-500';
    case 'HIGH':   return 'bg-orange-400 text-white border-orange-400';
    case 'NORMAL': return 'bg-indigo-500 text-white border-indigo-500';
    case 'LOW':    return 'bg-gray-400   text-white border-gray-400';
    default:       return 'bg-indigo-500 text-white border-indigo-500';
  }
}

const inputCls =
  'w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 ' +
  'focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';