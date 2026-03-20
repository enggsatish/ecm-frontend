/**
 * eformsStore.js
 * Zustand store for the eForms Designer.
 * Holds the live form schema being edited (sections, fields, rules, settings).
 * Separate from server state (TanStack Query). This store is the local working copy.
 *
 * Sprint-C change: Added workflowConfig fields to DEFAULT_FORM_META and
 * initFromDefinition so FormSettingsPanel can read/write workflow linkage.
 */
import { create } from 'zustand';

const DEFAULT_SCHEMA = {
  layout: 'SINGLE_PAGE',
  allowSaveDraft: true,
  confirmOnSubmit: false,
  submitButtonLabel: 'Submit',
  sections: [],
  globalRules: [],
};

const DEFAULT_FORM_META = {
  name: '',
  description: '',
  formKey: '',
  documentCategoryId: null,     // FK → document_categories, determines OCR template
  tags: [],
  // ── Workflow linkage ──────────────────────────────────────────────────────
  // Maps to WorkflowConfig JSONB on the backend FormDefinition entity.
  workflowKey:     '',      // workflowDefinitionKey — Flowable processKey
  assignToRole:    '',      // override default role from the workflow definition
  triggerOnSubmit: true,    // if false, submission never starts a workflow
  slaDays:         5,       // SLA deadline in calendar days from submission
  priority:        'NORMAL', // LOW | NORMAL | HIGH | URGENT
};

export const useEFormsDesignerStore = create((set, get) => ({
  // The definition id (null = new form)
  definitionId: null,

  // Top-level form metadata
  meta: { ...DEFAULT_FORM_META },

  // The FormSchema object (sections + globalRules + layout settings)
  schema: { ...DEFAULT_SCHEMA },

  // Which field is currently selected in the designer
  selectedFieldId: null,

  // Which section is currently selected
  selectedSectionId: null,

  // Designer UI state
  activePanel: 'canvas', // 'canvas' | 'settings' | 'rules'
  isDirty: false,

  // ── Initialise from existing definition ─────────────────────────────────
  // workflowConfig is a JSONB object — destructure into flat meta fields.
  initFromDefinition: (definition) => {
    const wfc = definition.workflowConfig || {};
    set({
      definitionId: definition.id,
      meta: {
        name:        definition.name             || '',
        description: definition.description      || '',
        formKey:     definition.formKey          || '',
        documentCategoryId: definition.documentCategoryId || null,
        tags:        definition.tags             || [],
        // Workflow config fields
        workflowKey:     wfc.workflowDefinitionKey || '',
        assignToRole:    wfc.assignToRole          || '',
        triggerOnSubmit: wfc.triggerOnSubmit       !== undefined ? wfc.triggerOnSubmit : true,
        slaDays:         wfc.slaDays               ?? 5,
        priority:        wfc.defaultPriority       || 'NORMAL',
      },
      schema: definition.schema || { ...DEFAULT_SCHEMA },
      isDirty: false,
      selectedFieldId: null,
      selectedSectionId: null,
    });
  },

  reset: () =>
    set({
      definitionId: null,
      meta: { ...DEFAULT_FORM_META },
      schema: { ...DEFAULT_SCHEMA },
      selectedFieldId: null,
      selectedSectionId: null,
      activePanel: 'canvas',
      isDirty: false,
    }),

  // ── Meta updates ─────────────────────────────────────────────────────────
  updateMeta: (partial) =>
    set((s) => ({ meta: { ...s.meta, ...partial }, isDirty: true })),

  // ── Schema / layout settings ─────────────────────────────────────────────
  updateSchemaSettings: (partial) =>
    set((s) => ({ schema: { ...s.schema, ...partial }, isDirty: true })),

  // ── Sections ─────────────────────────────────────────────────────────────
  addSection: () => {
    const id = crypto.randomUUID();
    const section = {
      id,
      title: 'New Section',
      page: 1,
      fields: [],
    };
    set((s) => ({
      schema: { ...s.schema, sections: [...s.schema.sections, section] },
      selectedSectionId: id,
      isDirty: true,
    }));
    return id;
  },

  updateSection: (sectionId, partial) =>
    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.map((sec) =>
          sec.id === sectionId ? { ...sec, ...partial } : sec
        ),
      },
      isDirty: true,
    })),

  removeSection: (sectionId) =>
    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.filter((sec) => sec.id !== sectionId),
      },
      selectedSectionId:
        s.selectedSectionId === sectionId ? null : s.selectedSectionId,
      isDirty: true,
    })),

  // ── Fields ───────────────────────────────────────────────────────────────
  addField: (sectionId, fieldType, insertAtIndex = null) => {
    const id = crypto.randomUUID();
    const key = `field_${Date.now()}`;
    const newField = buildDefaultField(id, key, fieldType);

    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const fields = [...sec.fields];
          if (insertAtIndex !== null) {
            fields.splice(insertAtIndex, 0, newField);
          } else {
            fields.push(newField);
          }
          return { ...sec, fields };
        }),
      },
      selectedFieldId: id,
      isDirty: true,
    }));
    return id;
  },

  updateField: (sectionId, fieldId, partial) =>
    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return {
            ...sec,
            fields: sec.fields.map((f) =>
              f.id === fieldId ? { ...f, ...partial } : f
            ),
          };
        }),
      },
      isDirty: true,
    })),

  removeField: (sectionId, fieldId) =>
    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          return { ...sec, fields: sec.fields.filter((f) => f.id !== fieldId) };
        }),
      },
      selectedFieldId: s.selectedFieldId === fieldId ? null : s.selectedFieldId,
      isDirty: true,
    })),

  reorderFields: (sectionId, fromIndex, toIndex) =>
    set((s) => ({
      schema: {
        ...s.schema,
        sections: s.schema.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const fields = [...sec.fields];
          const [moved] = fields.splice(fromIndex, 1);
          fields.splice(toIndex, 0, moved);
          return { ...sec, fields };
        }),
      },
      isDirty: true,
    })),

  // ── Global Rules ─────────────────────────────────────────────────────────
  addGlobalRule: (rule) =>
    set((s) => ({
      schema: {
        ...s.schema,
        globalRules: [...(s.schema.globalRules || []), rule],
      },
      isDirty: true,
    })),

  updateGlobalRule: (ruleId, partial) =>
    set((s) => ({
      schema: {
        ...s.schema,
        globalRules: s.schema.globalRules.map((r) =>
          r.id === ruleId ? { ...r, ...partial } : r
        ),
      },
      isDirty: true,
    })),

  removeGlobalRule: (ruleId) =>
    set((s) => ({
      schema: {
        ...s.schema,
        globalRules: s.schema.globalRules.filter((r) => r.id !== ruleId),
      },
      isDirty: true,
    })),

  // ── Selection ────────────────────────────────────────────────────────────
  selectField: (fieldId) => set({ selectedFieldId: fieldId }),
  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),
  clearSelection: () => set({ selectedFieldId: null }),

  // ── Panel navigation ─────────────────────────────────────────────────────
  setActivePanel: (panel) => set({ activePanel: panel }),

  // ── Dirty flag ───────────────────────────────────────────────────────────
  markClean: () => set({ isDirty: false }),

  // ── Derived helpers ──────────────────────────────────────────────────────
  getSelectedField: () => {
    const { schema, selectedFieldId } = get();
    for (const sec of schema.sections) {
      const f = sec.fields.find((f) => f.id === selectedFieldId);
      if (f) return { field: f, sectionId: sec.id };
    }
    return null;
  },

  getAllFieldKeys: () => {
    const { schema } = get();
    return schema.sections.flatMap((s) =>
      s.fields
        .filter((f) => f.key)
        .map((f) => ({ key: f.key, label: f.label, type: f.type }))
    );
  },
}));

// ─── Field Defaults by Type ──────────────────────────────────────────────────
function buildDefaultField(id, key, type) {
  const base = {
    id,
    key,
    type,
    label: fieldTypeLabel(type),
    required: false,
    colSpan: 6,
    placeholder: '',
    helpText: '',
    rules: [],
  };

  switch (type) {
    case 'DROPDOWN':
    case 'OPTION_BUTTON':
    case 'CHECKBOX_GROUP':
      return { ...base, options: [{ value: 'option1', label: 'Option 1' }] };
    case 'NUMBER':
      return { ...base, validation: { min: null, max: null } };
    case 'TEXT_INPUT':
    case 'EMAIL':
    case 'PHONE':
      return { ...base, validation: { minLength: null, maxLength: null } };
    case 'TEXT_AREA':
      return { ...base, validation: { maxLength: null }, rows: 4 };
    case 'SECTION_HEADER':
      return { ...base, label: 'Section Header', colSpan: 12 };
    case 'PARAGRAPH':
      return { ...base, label: 'Add descriptive text here...', colSpan: 12 };
    case 'DIVIDER':
      return { ...base, label: '', colSpan: 12 };
    default:
      return base;
  }
}

function fieldTypeLabel(type) {
  const map = {
    TEXT_INPUT: 'Text Input',
    TEXT_AREA: 'Text Area',
    NUMBER: 'Number',
    EMAIL: 'Email Address',
    PHONE: 'Phone Number',
    DATE: 'Date',
    DROPDOWN: 'Dropdown',
    OPTION_BUTTON: 'Option Buttons',
    CHECKBOX: 'Checkbox',
    CHECKBOX_GROUP: 'Checkbox Group',
    SECTION_HEADER: 'Section Header',
    PARAGRAPH: 'Paragraph',
    DIVIDER: 'Divider',
  };
  return map[type] || type;
}