/**
 * FormFillPage.jsx
 * Route: /eforms/fill/:formKey
 *
 * Three-step form fill flow:
 *   Step 0 — Party selector (search and pick customer/counterparty)
 *   Step 1 — Fill form fields (FormRenderer — validates, then calls onReview)
 *   Step 2 — Review & Submit (read-only summary + final submit to API)
 */
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Building2, Send,
  Loader2, AlertCircle, CheckCircle2, Users, FileText,
} from 'lucide-react'
import { useFormSchema, useSubmission, useSubmitForm } from '../../hooks/useEForms'
import toast from 'react-hot-toast'
import FormRenderer from '../../components/eforms/renderer/FormRenderer'
import PartySearch from '../../components/common/PartySearch'

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full
                             ${done   ? 'text-green-700 bg-green-50'
                             : active ? 'text-blue-700 bg-blue-100'
                             :          'text-gray-400 bg-gray-100'}`}>
              {done
                ? <CheckCircle2 size={13} />
                : <span className={`w-4 h-4 rounded-full border-2 text-center leading-3 text-xs
                                    ${active ? 'border-blue-600 text-blue-600' : 'border-gray-300'}`}>
                    {i + 1}
                  </span>}
              {s}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px mx-1 ${i < current ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 0: Party selector ────────────────────────────────────────────────────
function PartyStep({ selectedParty, onSelect, onNext }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          Select Customer / Party
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Search for the customer or counterparty this form is being submitted on behalf of.
        </p>
      </div>
      <PartySearch
        value={selectedParty}
        onChange={onSelect}
        size="default"
        autoSearch={false}
        maxResults={20}
        showHint={false}
        placeholder="Search by name, ID, or email…"
      />
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => { onSelect(null); onNext(); }}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Continue without selecting a party
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600
                     text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Next
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Review panel ──────────────────────────────────────────────────────
function ReviewStep({ schema, formData, selectedParty, partyContext, formKey, submissionId, caseId, checklistItemId, onBack, onSuccess }) {
  const submitMutation = useSubmitForm()

  const handleFinalSubmit = () => {
    // Include case context in submission data so it can be used
    // to auto-link the document after workflow approval
    const enrichedData = { ...formData }
    if (caseId) enrichedData._caseId = caseId
    if (checklistItemId) enrichedData._checklistItemId = checklistItemId

    submitMutation.mutate(
      {
        formKey,
        submissionData: enrichedData,
        draft: false,
        ...(partyContext?.partyExternalId && { partyExternalId: partyContext.partyExternalId }),
        ...(submissionId && { existingSubmissionId: submissionId }),
        ...(caseId && { skipWorkflow: true }),  // case-linked forms — case manages review flow
      },
      { onSuccess }
    )
  }

  // Flatten visible fields from schema for the review summary
  const allFields = (schema?.sections || []).flatMap((s) => s.fields || [])
  const displayFields = allFields.filter(
    (f) => !['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER'].includes(f.type)
  )

  const formatValue = (field, val) => {
    if (val == null || val === '') return <span className="text-gray-400 italic">—</span>
    if (Array.isArray(val)) return val.join(', ')
    if (field.type === 'CHECKBOX') return val ? 'Yes' : 'No'
    if (field.type === 'DATE') {
      try { return new Date(val).toLocaleDateString() } catch { return val }
    }
    return String(val)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <FileText size={16} className="text-indigo-500" />
          Review Your Answers
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Please check your answers below before submitting.
        </p>
      </div>

      {/* Party banner */}
      {selectedParty && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <Building2 size={14} className="text-blue-500 flex-shrink-0" />
          <span className="text-sm text-blue-700 font-medium">{selectedParty.displayName}</span>
          <span className="text-xs text-blue-400 font-mono">({selectedParty.externalId})</span>
        </div>
      )}

      {/* Field summary — per section */}
      {(schema?.sections || []).map((section) => {
        const sectionFields = (section.fields || []).filter(
          (f) => !['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER'].includes(f.type)
        )
        if (sectionFields.length === 0) return null
        return (
          <div key={section.id} className="rounded-xl border border-gray-200 overflow-hidden">
            {section.title && (
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {sectionFields.map((field) => (
                <div key={field.id} className="flex items-start gap-4 px-4 py-3">
                  <span className="w-40 flex-shrink-0 text-xs font-medium text-gray-500 pt-0.5">
                    {field.label}
                  </span>
                  <span className="text-sm text-gray-800 break-words min-w-0">
                    {formatValue(field, formData[field.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitMutation.isPending}
          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium
                     rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          ← Edit Answers
        </button>

        <button
          type="button"
          onClick={handleFinalSubmit}
          disabled={submitMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-semibold
                     rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          ) : (
            <><Send className="w-4 h-4" /> Confirm & Submit</>
          )}
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function FormFillPage() {
  const { formKey } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const submissionId    = searchParams.get('submission')
  const caseId          = searchParams.get('caseId')
  const checklistItemId = searchParams.get('checklistItemId')
  const partyRef        = searchParams.get('partyRef')

  const [step,          setStep]          = useState(caseId ? 1 : 0)   // skip party step if case context provides it
  const [selectedParty, setSelectedParty] = useState(null)
  const [filledData,    setFilledData]    = useState({})  // captured from FormRenderer on review

  const { data: formDef, isLoading: schemaLoading, error: schemaError } = useFormSchema(formKey)
  const { data: existingSubmission, isLoading: submissionLoading }      = useSubmission(submissionId)

  const isLoading = schemaLoading || (submissionId && submissionLoading)

  // Called after the final API submit in step 2
  const handleSubmitSuccess = () => {
    if (caseId) {
      toast.success('Form submitted — it will appear in the case checklist after approval')
      navigate('/cases')
    } else {
      navigate('/eforms/submissions/mine')
    }
  }

  // Called by FormRenderer when all fields are valid — advance to review step
  const handleReview = (data) => {
    setFilledData(data)
    setStep(2)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (schemaError || !formDef) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Form not found</p>
          <p className="text-xs text-gray-400 mt-1">
            The form <span className="font-mono">{formKey}</span> is not available or has been archived.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    )
  }

  const schema      = formDef.schema || formDef
  const name        = formDef.name  || formKey
  const description = formDef.description
  const defId       = formDef.definitionId || formDef.id

  const partyContext = selectedParty
    ? {
        partyId:          selectedParty.id,
        partyExternalId:  selectedParty.externalId || selectedParty.customerRef,
        partyDisplayName: selectedParty.displayName,
      }
    : partyRef
    ? { partyExternalId: partyRef }
    : {}

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Form header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
          {description && <p className="text-gray-500 mt-1.5">{description}</p>}

          {existingSubmission?.status === 'DRAFT' && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-xs font-medium text-amber-700">Resuming saved draft</span>
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="mb-6">
          <StepIndicator
            current={step}
            steps={['Select Party', 'Fill Form', 'Review & Submit']}
          />
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Step 0: Party selection */}
          {step === 0 && (
            <PartyStep
              selectedParty={selectedParty}
              onSelect={setSelectedParty}
              onNext={() => setStep(1)}
            />
          )}

          {/* Step 1: Form fill */}
          {step === 1 && (
            <div className="space-y-4">
              {selectedParty && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <Building2 size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-blue-700 font-medium">{selectedParty.displayName}</span>
                  <span className="text-xs text-blue-400 font-mono">({selectedParty.externalId})</span>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="ml-auto text-xs text-blue-400 hover:text-blue-600 underline"
                  >
                    Change
                  </button>
                </div>
              )}

              <FormRenderer
                schema={schema}
                formKey={formKey}
                definitionId={defId}
                initialData={existingSubmission?.submissionData ?? filledData}
                submissionId={submissionId}
                partyContext={partyContext}
                onReview={handleReview}          /* ← validated data → step 2 */
                onBack={() => setStep(0)}
              />
            </div>
          )}

          {/* Step 2: Review & submit */}
          {step === 2 && (
            <ReviewStep
              schema={schema}
              formData={filledData}
              selectedParty={selectedParty}
              partyContext={partyContext}
              formKey={formKey}
              submissionId={submissionId}
              caseId={caseId}
              checklistItemId={checklistItemId}
              onBack={() => setStep(1)}
              onSuccess={handleSubmitSuccess}   /* ← navigate after API call */
            />
          )}
        </div>
      </div>
    </div>
  )
}