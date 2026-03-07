/**
 * FieldRenderer.jsx
 * Renders a single FormField based on its type.
 * Controlled — receives value and onChange from parent FormRenderer.
 * Respects hidden/required/disabled state from rule engine output.
 */

export default function FieldRenderer({ field, value, onChange, isRequired, isDisabled, error }) {
  const baseInputCls = `w-full text-sm border rounded-lg px-3 py-2 transition-colors
    focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
    disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
    ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}`;

  switch (field.type) {
    case 'TEXT_INPUT':
    case 'EMAIL':
    case 'PHONE':
      return (
        <input
          type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          disabled={isDisabled}
          className={baseInputCls}
        />
      );

    case 'TEXT_AREA':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          disabled={isDisabled}
          rows={field.rows || 4}
          className={`${baseInputCls} resize-y`}
        />
      );

    case 'NUMBER':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={field.placeholder || ''}
          disabled={isDisabled}
          min={field.validation?.min}
          max={field.validation?.max}
          className={baseInputCls}
        />
      );

    case 'DATE':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={baseInputCls}
        />
      );

    case 'DROPDOWN':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={`${baseInputCls} cursor-pointer`}
        >
          <option value="">Select an option...</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'OPTION_BUTTON':
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => !isDisabled && onChange(opt.value)}
              disabled={isDisabled}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all
                ${value === opt.value
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'border-gray-300 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );

    case 'CHECKBOX':
      return (
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={isDisabled}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${value ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}>
              {value && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-700">{field.label}</span>
        </label>
      );

    case 'CHECKBOX_GROUP': {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (v) => {
        if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
        else onChange([...selected, v]);
      };
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => !isDisabled && toggle(opt.value)}
                  disabled={isDisabled}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                  ${selected.includes(opt.value) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                  {selected.includes(opt.value) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'SECTION_HEADER':
      return (
        <div className="pt-2 pb-1">
          <h3 className="text-base font-semibold text-gray-800">{field.label}</h3>
          <div className="mt-1 h-px bg-gray-200" />
        </div>
      );

    case 'PARAGRAPH':
      return (
        <p className="text-sm text-gray-600 leading-relaxed">{field.label}</p>
      );

    case 'DIVIDER':
      return <div className="h-px bg-gray-200 my-1" />;

    default:
      return (
        <div className="text-xs text-gray-400 italic">Unknown field type: {field.type}</div>
      );
  }
}