/**
 * FormDesignerPage.jsx
 * Route: /eforms/designer/new  (new form)
 *        /eforms/designer/:id  (edit existing draft)
 *
 * Three-panel layout (full viewport height — AppLayout strips padding/scroll
 * for this route via isFullHeightRoute()):
 *   [Toolbar]
 *   [FieldPalette | DesignerCanvas | FieldConfigPanel or FormSettingsPanel]
 *
 * When activePanel === 'rules'    → canvas is replaced by RuleBuilder
 * When activePanel === 'settings' → right panel shows FormSettingsPanel
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Eye, Globe, Settings, Zap, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useEFormsDesignerStore } from '../../store/eformsStore';
import {
  useFormDefinition,
  useCreateFormDefinition,
  useUpdateFormDefinition,
  usePublishForm,
} from '../../hooks/useEForms';

import FieldPalette      from '../../components/eforms/designer/FieldPalette';
import DesignerCanvas    from '../../components/eforms/designer/DesignerCanvas';
import FieldConfigPanel  from '../../components/eforms/designer/FieldConfigPanel';
import FormSettingsPanel from '../../components/eforms/designer/FormSettingsPanel';
import RuleBuilder       from '../../components/eforms/designer/RuleBuilder';
import FormRenderer      from '../../components/eforms/renderer/FormRenderer';

export default function FormDesignerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [previewMode, setPreviewMode] = useState(false);

  const {
    meta,
    schema,
    isDirty,
    activePanel,
    initFromDefinition,
    reset,
    setActivePanel,
    markClean,
  } = useEFormsDesignerStore();

  // Load existing definition when editing
  const { data: definition, isLoading } = useFormDefinition(isNew ? null : id);
  const isPublished = definition?.status === 'PUBLISHED';

  const createMutation = useCreateFormDefinition();
  const updateMutation = useUpdateFormDefinition();
  const publishMutation = usePublishForm();

  // Initialise store from server data (or blank for new forms)
  useEffect(() => {
    if (!isNew && definition) {
      initFromDefinition(definition);
    } else if (isNew) {
      reset();
    }
    return () => reset(); // clean up on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, definition]);

  // ── Build payload from store ──────────────────────────────────────────────
  // formKey is @NotBlank on the backend — auto-derive from name if designer left it blank.
  const buildPayload = () => {
  const derivedFormKey =
    meta.formKey ||
    meta.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  // Build workflowConfig only when a workflow key has been set.
  // Sending null/empty workflowConfig tells the backend "no workflow attached".
  const workflowConfig = meta.workflowKey
    ? {
        triggerOnSubmit:      meta.triggerOnSubmit,
        workflowDefinitionKey: meta.workflowKey,     // Flowable processKey
        assignToRole:          meta.assignToRole || undefined,
        defaultPriority:       meta.priority || 'NORMAL',
        slaDays:               meta.slaDays   || 5,
      }
    : null;

  return {
    name:            meta.name,
    description:     meta.description     || undefined,
    formKey:         derivedFormKey        || undefined,
    documentCategoryId: meta.documentCategoryId || undefined,
    tags:            meta.tags?.length ? meta.tags : undefined,
    schema,
    workflowConfig,
  };
};

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!meta.name.trim()) {
      toast.error('Form name is required — open Form Settings to set it');
      setActivePanel('settings');
      return;
    }
    if (isNew) {
      createMutation.mutate(buildPayload(), {
        onSuccess: (res) => {
          const newId = res.data?.data?.id ?? res.data?.id;
          markClean();
          if (newId) navigate(`/eforms/designer/${newId}`, { replace: true });
        },
      });
    } else {
      updateMutation.mutate({ id, ...buildPayload() }, { onSuccess: markClean });
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const handlePublish = () => {
    if (isDirty) { toast.error('Save your changes before publishing'); return; }
    if (isNew || !id) { toast.error('Save the draft first'); return; }
    publishMutation.mutate(id, {
      onSuccess: () => navigate('/eforms/designer/list'),
    });
  };

  // ── Loading (editing existing form) ──────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (previewMode) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-700">
            Preview Mode — changes are not saved from here
          </span>
          <button
            onClick={() => setPreviewMode(false)}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
          >
            ← Back to Designer
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{meta.name || 'Untitled Form'}</h2>
              {meta.description && <p className="text-gray-500 mt-1">{meta.description}</p>}
            </div>
            <FormRenderer schema={schema} formKey={meta.formKey} readOnly={false} />
          </div>
        </div>
      </div>
    );
  }

  // ── Designer ──────────────────────────────────────────────────────────────
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">

        <button
          onClick={() => navigate('/eforms/designer/list')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Back to list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 mx-1">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {meta.name || <span className="italic text-gray-400">Untitled Form</span>}
          </p>
        </div>

        {isDirty && (
          <span className="text-xs text-amber-500 font-medium flex-shrink-0 mr-1">● Unsaved</span>
        )}

        {/* Design / Rules tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: 'canvas', label: 'Design' },
            { key: 'rules',  label: 'Rules', icon: Zap },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${activePanel === key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPreviewMode(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>

        <button
          onClick={() => setActivePanel(activePanel === 'settings' ? 'canvas' : 'settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
            ${activePanel === 'settings'
              ? 'bg-gray-100 border-gray-400 text-gray-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          <Settings className="w-3.5 h-3.5" /> Settings
        </button>
        
        {/* Handle clone vs save and publish button. */}
        {isPublished ? (
          <button
            onClick={() => cloneNutation.mutate (id, {
              onSuccess: (res) =>  navigate(`/eforms/designer/${res.data.id}`)
            })}> Clone to Edit </button>
        ) : (
          <>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </button>

          <button
            onClick={handlePublish}
            disabled={publishMutation.isPending || isDirty || isNew}
            title={isDirty ? 'Save first' : isNew ? 'Save as draft first' : 'Publish form'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {publishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            Publish
          </button>
        </>
        )}
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {activePanel !== 'rules' && <FieldPalette />}

        {activePanel === 'rules' ? <RuleBuilder /> : <DesignerCanvas />}

        {activePanel === 'settings'
          ? <FormSettingsPanel />
          : activePanel === 'canvas'
            ? <FieldConfigPanel />
            : null}
      </div>
    </div>
  );
}