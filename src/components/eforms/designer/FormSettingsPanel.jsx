/**
 * FormSettingsPanel.jsx
 * Form-level settings: name, key, productType, formType, layout, tags, etc.
 * Shown when activePanel === 'settings' in the designer toolbar.
 */
import { useEFormsDesignerStore } from '../../../store/eformsStore';

const PRODUCT_TYPES = ['MORTGAGE', 'AUTO_LOAN', 'PERSONAL_LOAN', 'CREDIT_CARD', 'BUSINESS_LOAN', 'INSURANCE'];
const FORM_TYPES = ['APPLICATION', 'KYC', 'AML', 'DISCLOSURE', 'CONSENT', 'AMENDMENT', 'CLAIM', 'OTHER'];
const LAYOUTS = [
  { value: 'SINGLE_PAGE', label: 'Single Page' },
  { value: 'MULTI_PAGE', label: 'Multi Page (Wizard)' },
  { value: 'ACCORDION', label: 'Accordion' },
];

export default function FormSettingsPanel() {
  const { meta, schema, updateMeta, updateSchemaSettings } = useEFormsDesignerStore();

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

  const removeTag = (tag) => updateMeta({ tags: meta.tags.filter((t) => t !== tag) });

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-700">Form Settings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <Field label="Form Key" hint="URL-safe identifier, auto-generated if blank">
            <input
              type="text"
              value={meta.formKey}
              onChange={(e) => updateMeta({ formKey: e.target.value.replace(/\s+/g, '-').toLowerCase() })}
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
        </Section>

        <Section title="Classification">
          <Field label="Product Type">
            <select
              value={meta.productType}
              onChange={(e) => updateMeta({ productType: e.target.value })}
              className={inputCls}
            >
              <option value="">Select product type...</option>
              {PRODUCT_TYPES.map((pt) => (
                <option key={pt} value={pt}>{pt.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Form Type">
            <select
              value={meta.formType}
              onChange={(e) => updateMeta({ formType: e.target.value })}
              className={inputCls}
            >
              <option value="">Select form type...</option>
              {FORM_TYPES.map((ft) => (
                <option key={ft} value={ft}>{ft.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
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
      </div>
    </aside>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1 text-xs">({hint})</span>}
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

const inputCls =
  'w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';