/**
 * FormRenderer.jsx
 * Full dynamic form renderer. Consumes a FormSchema and renders all sections/fields.
 * Implements the client-side rule engine on every change.
 * Used by FormFillPage (step 1 – data collection) and the designer's preview mode.
 *
 * Props:
 *   schema          - FormSchema object from the API
 *   formKey         - String (for submit payload)
 *   definitionId    - UUID
 *   readOnly        - boolean (for preview/view mode)
 *   initialData     - initial form values (replaces old existingData)
 *   submissionId    - UUID of existing submission (draft resume)
 *   partyContext    - { partyId, partyExternalId, partyDisplayName } | {}
 *   onReview        - (formData) => void — when provided, the primary action
 *                     validates and hands data UP to the parent (no API call).
 *                     Used by FormFillPage so step 2 can handle the final submit.
 *   onSubmitSuccess - () => void — used only when FormRenderer submits directly
 *                     (preview mode / standalone use).
 *   onBack          - () => void — Back button handler
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Save, Send, ArrowRight, Loader2 } from 'lucide-react';
import FieldRenderer from './FieldRenderer';
import { evaluateRules } from '../../../utils/ruleEngine';
import { useSubmitForm } from '../../../hooks/useEForms';

export default function FormRenderer({
  schema,
  formKey,
  definitionId,
  readOnly = false,
  initialData = {},
  submissionId = null,
  partyContext = {},
  onReview        = null,   // step-based: hand validated data to parent for step 2
  onSubmitSuccess = null,   // standalone: called after API success
  onBack          = null,
}) {
  // Build initial form data with defaults so rules evaluate correctly on load.
  // Checkbox defaults to false, other fields to empty string, so rules like
  // "when checkbox equals unchecked → hide field" fire immediately.
  const [formData, setFormData] = useState(() => {
    const defaults = {};
    for (const section of (schema?.sections || [])) {
      for (const field of (section.fields || [])) {
        if (!field.key) continue;
        if (field.type === 'CHECKBOX') defaults[field.key] = false;
        else if (field.type === 'CHECKBOX_GROUP') defaults[field.key] = [];
      }
    }
    return { ...defaults, ...(initialData || {}) };
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const submitMutation = useSubmitForm();

  const ruleResult = evaluateRules(schema, formData);
  const { hidden, required: dynRequired, blocking, computed } = ruleResult;

  const computedJson = useMemo(() => JSON.stringify(computed), [computed]);

  useEffect(() => {
    const vals = JSON.parse(computedJson);
    if (Object.keys(vals).length > 0) {
      setFormData((prev) => ({ ...prev, ...vals }));
    }
  }, [computedJson]);

  const handleChange = useCallback((fieldKey, value) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    if (submitAttempted) {
      setFieldErrors((prev) => ({ ...prev, [fieldKey]: null }));
    }
  }, [submitAttempted]);

  const validateAll = () => {
    const errors = {};
    for (const section of (schema?.sections || [])) {
      if (hidden.has('__section__' + section.id)) continue;
      for (const field of (section.fields || [])) {
        if (hidden.has(field.key)) continue;
        if (['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER'].includes(field.type)) continue;

        const isReq = field.required || dynRequired.has(field.key);
        const val = formData[field.key];
        const isEmpty =
          val == null ||
          String(val).trim() === '' ||
          (Array.isArray(val) && val.length === 0);

        if (isReq && isEmpty) {
          errors[field.key] = `${field.label || field.key} is required`;
          continue;
        }

        if (val != null && val !== '') {
          const v = field.validation || {};
          if (field.type === 'NUMBER') {
            const n = Number(val);
            if (v.min != null && n < v.min) errors[field.key] = `Minimum value is ${v.min}`;
            if (v.max != null && n > v.max) errors[field.key] = `Maximum value is ${v.max}`;
          }
          if (['TEXT_INPUT', 'TEXT_AREA'].includes(field.type)) {
            const s = String(val);
            if (v.minLength != null && s.length < v.minLength)
              errors[field.key] = `Minimum ${v.minLength} characters`;
            if (v.maxLength != null && s.length > v.maxLength)
              errors[field.key] = `Maximum ${v.maxLength} characters`;
          }
          if (field.type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errors[field.key] = 'Enter a valid email address';
          }
        }
      }
    }
    return errors;
  };

  const handleSaveDraft = () => {
    const payload = {
      formKey,
      submissionData: formData,
      draft: true,
      ...(partyContext?.partyExternalId && { partyExternalId: partyContext.partyExternalId }),
      ...(submissionId && { existingSubmissionId: submissionId }),
    };
    submitMutation.mutate(payload, { onSuccess: onSubmitSuccess });
  };

  /**
   * Primary action handler.
   * • onReview present → validate + call onReview(formData), NO API call (parent owns submit)
   * • otherwise        → validate + submit to API + call onSubmitSuccess
   */
  const handlePrimaryAction = () => {
    setSubmitAttempted(true);
    const errors = validateAll();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    if (blocking.length > 0) return;

    if (onReview) {
      onReview(formData);
      return;
    }

    if (schema?.confirmOnSubmit) {
      if (!window.confirm('Submit this form? You will not be able to edit it after submission.'))
        return;
    }
    submitMutation.mutate(
      {
        formKey,
        submissionData: formData,
        draft: false,
        ...(partyContext?.partyExternalId && { partyExternalId: partyContext.partyExternalId }),
        ...(submissionId && { existingSubmissionId: submissionId }),
      },
      { onSuccess: onSubmitSuccess }
    );
  };

  if (!schema) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        No schema available. Please check the form configuration.
      </div>
    );
  }

  const isInline = (schema.labelPosition || 'inline') === 'inline';
  const primaryLabel = onReview ? 'Review & Submit' : (schema.submitButtonLabel || 'Submit');
  const primaryIcon  = onReview ? <ArrowRight className="w-4 h-4" /> : <Send className="w-4 h-4" />;

  return (
    <div className="space-y-6">
      {/* Blocking messages */}
      {blocking.length > 0 && submitAttempted && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Cannot proceed</p>
            <ul className="mt-1 text-sm text-amber-700 list-disc list-inside space-y-0.5">
              {blocking.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Sections */}
      {(schema.sections || []).map((section) => {
        if (hidden.has('__section__' + section.id)) return null;
        const visibleFields = section.fields.filter((f) => !hidden.has(f.key));
        if (visibleFields.length === 0) return null;

        return (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {section.title && (
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-800">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                )}
              </div>
            )}
            <div className="px-6 py-5">
              <div className="grid grid-cols-12 gap-x-4 gap-y-3">
                {visibleFields.map((field) => {
                  const isReq = field.required || dynRequired.has(field.key);
                  const err = fieldErrors[field.key];
                  const isDisplayOnly = ['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER'].includes(field.type);
                  const isCheckbox = field.type === 'CHECKBOX';
                  const skipLabel = isDisplayOnly || isCheckbox;

                  return (
                    <div key={field.id} className={colSpanClass(field.colSpan || 6)}>
                      {isInline && !skipLabel ? (
                        /* Inline: label auto-width, input fills the rest */
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">
                            {field.label}
                            {isReq && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          <div className="flex-1 min-w-0">
                            <FieldRenderer field={field} value={formData[field.key]}
                              onChange={(val) => !readOnly && handleChange(field.key, val)}
                              isRequired={isReq} isDisabled={readOnly} error={err} />
                            {field.helpText && !err && (
                              <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
                            )}
                            {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
                          </div>
                        </div>
                      ) : (
                        /* Stacked: label above input, or display-only/checkbox */
                        <>
                          {!skipLabel && (
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                              {field.label}
                              {isReq && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                          )}
                          <FieldRenderer field={field} value={formData[field.key]}
                            onChange={(val) => !readOnly && handleChange(field.key, val)}
                            isRequired={isReq} isDisabled={readOnly} error={err} />
                          {field.helpText && !err && (
                            <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
                          )}
                          {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Validation summary */}
      {submitAttempted && Object.keys(fieldErrors).length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">
              Please fix the {Object.keys(fieldErrors).length} error
              {Object.keys(fieldErrors).length !== 1 ? 's' : ''} above before continuing
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium
                           rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {schema.allowSaveDraft && !onReview && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm
                           font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
            )}
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={submitMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium
                         rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <>{primaryIcon} {primaryLabel}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function colSpanClass(span) {
  const map = {
    3:  'col-span-12 sm:col-span-3',
    4:  'col-span-12 sm:col-span-4',
    6:  'col-span-12 sm:col-span-6',
    8:  'col-span-12 sm:col-span-8',
    12: 'col-span-12',
  };
  return map[span] || 'col-span-12 sm:col-span-6';
}