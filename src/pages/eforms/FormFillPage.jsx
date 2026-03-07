/**
 * FormFillPage.jsx
 * Route: /eforms/fill/:formKey
 * Renders the published form for a user to fill and submit.
 * Also used for editing a DRAFT submission.
 */
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useFormSchema, useSubmission } from '../../hooks/useEForms';
import FormRenderer from '../../components/eforms/renderer/FormRenderer';

export default function FormFillPage() {
  const { formKey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const submissionId = searchParams.get('submission'); // editing existing draft

  const { data: formDef, isLoading: schemaLoading, error: schemaError } = useFormSchema(formKey);
  const { data: existingSubmission, isLoading: submissionLoading } = useSubmission(submissionId);

  const isLoading = schemaLoading || (submissionId && submissionLoading);

  const handleSubmitSuccess = () => {
    navigate('/eforms/submissions/mine');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
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
    );
  }

  const schema = formDef.schema || formDef;
  const name = formDef.name || formKey;
  const description = formDef.description;
  const defId = formDef.definitionId || formDef.id;

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

        {/* Form */}
        <FormRenderer
          schema={schema}
          formKey={formKey}
          definitionId={defId}
          existingData={existingSubmission?.data || {}}
          submissionId={submissionId}
          onSubmitSuccess={handleSubmitSuccess}
        />
      </div>
    </div>
  );
}