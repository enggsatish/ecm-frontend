/**
 * DesignerCanvas.jsx
 * Center panel of the Form Designer.
 * Renders sections + fields. Accepts drag-drop from FieldPalette.
 * Fields can be reordered within a section via drag handles.
 */
import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { useEFormsDesignerStore } from '../../../store/eformsStore';

export default function DesignerCanvas() {
  const { schema, meta, addSection, selectedFieldId, selectField } = useEFormsDesignerStore();

  const isEmpty = schema.sections.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
      {/* Form preview header */}
      <div className="max-w-3xl mx-auto mb-4">
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">
            {meta.name || 'Untitled Form'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.description || 'No description'}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {isEmpty ? (
          <EmptyCanvas onAddSection={addSection} />
        ) : (
          schema.sections.map((section) => (
            <SectionBlock key={section.id} section={section} selectedFieldId={selectedFieldId} />
          ))
        )}

        {/* Add section button */}
        {!isEmpty && (
          <button
            onClick={addSection}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm
                       text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors
                       flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyCanvas({ onAddSection }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { addSection, addField } = useEFormsDesignerStore();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const fieldType = e.dataTransfer.getData('application/ecm-field-type');
    if (fieldType) {
      const sectionId = addSection();
      // addSection is async via set, so we use a small delay
      setTimeout(() => addField(sectionId, fieldType), 10);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed transition-colors py-16 flex flex-col items-center justify-center
        ${isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-white'}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <span className="text-2xl">🗂️</span>
      </div>
      <p className="text-sm font-medium text-gray-600">Drop a field here to start</p>
      <p className="text-xs text-gray-400 mt-1">or</p>
      <button
        onClick={onAddSection}
        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Add Section
      </button>
    </div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────
function SectionBlock({ section, selectedFieldId }) {
  const {
    updateSection,
    removeSection,
    addField,
    reorderFields,
    selectField,
  } = useEFormsDesignerStore();

  const [collapsed, setCollapsed] = useState(false);
  const [isDragOverSection, setIsDragOverSection] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggingFieldIdx, setDraggingFieldIdx] = useState(null);

  // Drag from palette → drop on section
  const handleSectionDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fieldType = e.dataTransfer.types.includes('application/ecm-field-type');
    if (fieldType) setIsDragOverSection(true);
  };

  const handleSectionDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverSection(false);
    const fieldType = e.dataTransfer.getData('application/ecm-field-type');
    if (fieldType) addField(section.id, fieldType);
  };

  // Drag existing fields to reorder
  const handleFieldDragStart = (e, idx) => {
    e.dataTransfer.setData('application/ecm-field-idx', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingFieldIdx(idx);
  };

  const handleFieldDragOver = (e, idx) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/ecm-field-idx')) {
      setDragOverIdx(idx);
    }
  };

  const handleFieldDrop = (e, toIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = parseInt(e.dataTransfer.getData('application/ecm-field-idx'), 10);
    if (!isNaN(fromIdx) && fromIdx !== toIdx) {
      reorderFields(section.id, fromIdx, toIdx);
    }
    setDragOverIdx(null);
    setDraggingFieldIdx(null);
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-colors shadow-sm overflow-hidden
        ${isDragOverSection ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}
      onDragOver={handleSectionDragOver}
      onDragLeave={() => setIsDragOverSection(false)}
      onDrop={handleSectionDrop}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 group">
        <input
          type="text"
          value={section.title}
          onChange={(e) => updateSection(section.id, { title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm font-semibold text-gray-700 bg-transparent border-none
                     focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
        />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button
          onClick={() => removeSection(section.id)}
          className="text-gray-300 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Fields grid */}
      {!collapsed && (
        <div className="p-4">
          {section.fields.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
              <p className="text-xs text-gray-400">Drop fields here</p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-3">
              {section.fields.map((field, idx) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  idx={idx}
                  isSelected={selectedFieldId === field.id}
                  isDragOver={dragOverIdx === idx}
                  isDragging={draggingFieldIdx === idx}
                  onSelect={() => selectField(field.id)}
                  onDragStart={(e) => handleFieldDragStart(e, idx)}
                  onDragOver={(e) => handleFieldDragOver(e, idx)}
                  onDrop={(e) => handleFieldDrop(e, idx)}
                />
              ))}
            </div>
          )}

          {/* Add field button */}
          <button
            onClick={() => addField(section.id, 'TEXT_INPUT')}
            className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-indigo-600 border border-dashed border-gray-200
                       hover:border-indigo-300 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add field
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────────
function FieldCard({ field, idx, isSelected, isDragOver, isDragging, onSelect, onDragStart, onDragOver, onDrop }) {
  const colClass = colSpanClass(field.colSpan || 6);

  return (
    <div
      className={`${colClass} relative`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onSelect}
        className={`rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-all group
          ${isDragging ? 'opacity-40' : ''}
          ${isDragOver ? 'border-indigo-400 shadow-md' : ''}
          ${isSelected
            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
          }`}
      >
        <div className="flex items-start gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab mt-0.5 flex-shrink-0 group-hover:text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">
              {field.label || '—'}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </p>
            <p className="text-xs text-gray-400 truncate font-mono">{field.type}</p>
          </div>
        </div>
        <FieldPreview field={field} />
      </div>
    </div>
  );
}

function FieldPreview({ field }) {
  const cls = 'mt-1.5 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-400 pointer-events-none';

  switch (field.type) {
    case 'TEXT_INPUT':
    case 'EMAIL':
    case 'PHONE':
      return <div className={cls}>{field.placeholder || 'Text input...'}</div>;
    case 'TEXT_AREA':
      return <div className={`${cls} h-10`}>{field.placeholder || 'Text area...'}</div>;
    case 'NUMBER':
      return <div className={cls}>0</div>;
    case 'DATE':
      return <div className={cls}>mm/dd/yyyy</div>;
    case 'DROPDOWN':
      return <div className={`${cls} flex justify-between`}><span>Select...</span><span>▾</span></div>;
    case 'OPTION_BUTTON':
      return (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(field.options || []).slice(0, 3).map((o) => (
            <span key={o.value} className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400">{o.label}</span>
          ))}
        </div>
      );
    case 'CHECKBOX':
      return <div className="mt-1.5 flex items-center gap-1"><span className="w-3 h-3 border border-gray-300 rounded inline-block" /><span className="text-xs text-gray-400">Checkbox</span></div>;
    case 'SECTION_HEADER':
      return <div className="mt-1 border-b border-gray-300" />;
    case 'PARAGRAPH':
      return <div className="mt-1 text-xs text-gray-400 line-clamp-2">{field.label}</div>;
    case 'DIVIDER':
      return <div className="mt-1.5 border-t border-gray-200" />;
    default:
      return null;
  }
}

function colSpanClass(span) {
  const map = { 3: 'col-span-3', 4: 'col-span-4', 6: 'col-span-6', 8: 'col-span-8', 12: 'col-span-12' };
  return map[span] || 'col-span-6';
}