/**
 * FieldConfigPanel.jsx
 * Right panel shown when a field is selected in the designer.
 * Allows editing label, key, required, colSpan, placeholder, options, validation.
 */
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useEFormsDesignerStore } from '../../../store/eformsStore';

const COL_SPANS = [
  { value: 3, label: '25%' },
  { value: 4, label: '33%' },
  { value: 6, label: '50%' },
  { value: 8, label: '67%' },
  { value: 12, label: '100%' },
];

const HAS_OPTIONS = ['DROPDOWN', 'OPTION_BUTTON', 'CHECKBOX_GROUP'];
const HAS_VALIDATION = ['TEXT_INPUT', 'TEXT_AREA', 'NUMBER', 'EMAIL', 'PHONE'];
const HAS_PLACEHOLDER = ['TEXT_INPUT', 'TEXT_AREA', 'NUMBER', 'EMAIL', 'PHONE', 'DATE'];
const DISPLAY_ONLY = ['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER'];

export default function FieldConfigPanel() {
  const { getSelectedField, updateField, removeField, clearSelection } = useEFormsDesignerStore();
  const selected = getSelectedField();

  if (!selected) {
    return (
      <aside className="w-64 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-2">
            <span className="text-gray-400 text-lg">↑</span>
          </div>
          <p className="text-xs text-gray-400">Click a field to configure it</p>
        </div>
      </aside>
    );
  }

  const { field, sectionId } = selected;
  const isDisplayOnly = DISPLAY_ONLY.includes(field.type);

  const update = (partial) => updateField(sectionId, field.id, partial);

  const updateValidation = (partial) =>
    update({ validation: { ...(field.validation || {}), ...partial } });

  const addOption = () => {
    const options = [...(field.options || [])];
    options.push({ value: `option${options.length + 1}`, label: `Option ${options.length + 1}` });
    update({ options });
  };

  const updateOption = (idx, partial) => {
    const options = [...(field.options || [])];
    options[idx] = { ...options[idx], ...partial };
    update({ options });
  };

  const removeOption = (idx) => {
    const options = [...(field.options || [])];
    options.splice(idx, 1);
    update({ options });
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <p className="text-xs font-semibold text-gray-700">Field Settings</p>
          <p className="text-xs text-gray-400 font-mono">{field.type}</p>
        </div>
        <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <Field label="Label">
          <input
            type="text"
            value={field.label || ''}
            onChange={(e) => update({ label: e.target.value })}
            className={inputCls}
            placeholder="Field label"
          />
        </Field>

        {/* Key — not shown for display-only */}
        {!isDisplayOnly && (
          <Field label="Field Key" hint="Used as the data key in submissions">
            <input
              type="text"
              value={field.key || ''}
              onChange={(e) => update({ key: e.target.value.replace(/\s+/g, '_') })}
              className={`${inputCls} font-mono text-xs`}
              placeholder="fieldKey"
            />
          </Field>
        )}

        {/* Column span */}
        <Field label="Width">
          <div className="flex gap-1 flex-wrap">
            {COL_SPANS.map((cs) => (
              <button
                key={cs.value}
                onClick={() => update({ colSpan: cs.value })}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  field.colSpan === cs.value
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                }`}
              >
                {cs.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Required toggle — not for display-only */}
        {!isDisplayOnly && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Required</span>
            <Toggle
              checked={field.required}
              onChange={(v) => update({ required: v })}
            />
          </div>
        )}

        {/* Placeholder */}
        {HAS_PLACEHOLDER.includes(field.type) && (
          <Field label="Placeholder">
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => update({ placeholder: e.target.value })}
              className={inputCls}
              placeholder="Placeholder text..."
            />
          </Field>
        )}

        {/* Help text */}
        {!isDisplayOnly && (
          <Field label="Help Text">
            <input
              type="text"
              value={field.helpText || ''}
              onChange={(e) => update({ helpText: e.target.value })}
              className={inputCls}
              placeholder="Optional hint"
            />
          </Field>
        )}

        {/* Options */}
        {HAS_OPTIONS.includes(field.type) && (
          <Field label="Options">
            <div className="space-y-1.5">
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(idx, { label: e.target.value })}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Label"
                  />
                  <input
                    type="text"
                    value={opt.value}
                    onChange={(e) => updateOption(idx, { value: e.target.value })}
                    className="w-20 text-xs border border-gray-200 rounded px-2 py-1 font-mono focus:outline-none focus:border-indigo-400"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => removeOption(idx)}
                    className="text-gray-300 hover:text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={addOption}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1"
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            </div>
          </Field>
        )}

        {/* Validation */}
        {HAS_VALIDATION.includes(field.type) && (
          <Field label="Validation">
            {field.type === 'NUMBER' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Min</label>
                  <input
                    type="number"
                    value={field.validation?.min ?? ''}
                    onChange={(e) => updateValidation({ min: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inputCls} mt-0.5`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Max</label>
                  <input
                    type="number"
                    value={field.validation?.max ?? ''}
                    onChange={(e) => updateValidation({ max: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inputCls} mt-0.5`}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Min length</label>
                  <input
                    type="number"
                    value={field.validation?.minLength ?? ''}
                    onChange={(e) => updateValidation({ minLength: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inputCls} mt-0.5`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Max length</label>
                  <input
                    type="number"
                    value={field.validation?.maxLength ?? ''}
                    onChange={(e) => updateValidation({ maxLength: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inputCls} mt-0.5`}
                  />
                </div>
              </div>
            )}
          </Field>
        )}
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => removeField(sectionId, field.id)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium
                     text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400
                     rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove field
        </button>
      </div>
    </aside>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const inputCls =
  'w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200';