/**
 * DesignerCanvas.jsx
 * Center panel of the Form Designer.
 * Renders sections + fields. Accepts drag-drop from FieldPalette.
 * Fields can be reordered within a section via drag handles.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { useEFormsDesignerStore } from '../../../store/eformsStore';

export default function DesignerCanvas() {
  const { schema, meta, addSection, selectedFieldId, getSelectedField, removeField } = useEFormsDesignerStore();
  const isInline = (schema.labelPosition || 'inline') === 'inline';

  // Delete key removes selected field
  const handleKeyDown = useCallback((e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
      // Don't delete if user is typing in an input
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      const selected = getSelectedField()
      if (selected) removeField(selected.sectionId, selected.field.id)
    }
  }, [selectedFieldId, getSelectedField, removeField])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const isEmpty = schema.sections.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-200/60 p-6">
      {/* A4 paper canvas */}
      <div className="mx-auto bg-white shadow-lg rounded-sm border border-gray-300/50"
           style={{ width: '210mm', minHeight: '297mm', maxWidth: '100%' }}>

        {/* Form title block — like a real paper header */}
        <div className="px-10 pt-10 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {meta.name || 'Untitled Form'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.description || 'No description'}
          </p>
        </div>

        {/* Form body */}
        <div className="px-10 py-6 space-y-4">
          {isEmpty ? (
            <EmptyCanvas onAddSection={addSection} />
          ) : (
            schema.sections.map((section) => (
              <SectionBlock key={section.id} section={section} selectedFieldId={selectedFieldId} isInline={isInline} />
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

        {/* Paper footer — QR code placeholder */}
        <div className="px-10 py-4 border-t border-gray-100 mt-auto">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-gray-300">ECM Form &mdash; QR code will appear here in PDF</p>
            <div className="w-10 h-10 border border-dashed border-gray-200 rounded flex items-center justify-center">
              <span className="text-[8px] text-gray-300">QR</span>
            </div>
          </div>
        </div>
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
function SectionBlock({ section, selectedFieldId, isInline }) {
  const {
    updateSection,
    removeSection,
    addField,
    updateField,
    reorderFields,
    selectField,
  } = useEFormsDesignerStore();

  const gridRef = useRef(null);

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
            <div ref={gridRef} className="grid grid-cols-12 gap-3">
              {section.fields.map((field, idx) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  idx={idx}
                  isInline={isInline}
                  isSelected={selectedFieldId === field.id}
                  isDragOver={dragOverIdx === idx}
                  isDragging={draggingFieldIdx === idx}
                  onSelect={() => selectField(field.id)}
                  onDragStart={(e) => handleFieldDragStart(e, idx)}
                  onDragOver={(e) => handleFieldDragOver(e, idx)}
                  onDrop={(e) => handleFieldDrop(e, idx)}
                  gridRef={gridRef}
                  onResize={(span) => updateField(section.id, field.id, { colSpan: span })}
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
// eslint-disable-next-line no-unused-vars
function FieldCard({ field, idx, isInline, isSelected, isDragOver, isDragging, onSelect, onDragStart, onDragOver, onDrop, gridRef, onResize }) {
  const cardRef = useRef(null);
  const [liveSpan, setLiveSpan] = useState(field.colSpan || 6);
  const [isResizing, setIsResizing] = useState(false);
  const isDisplayOnly = ['SECTION_HEADER', 'PARAGRAPH', 'LABEL', 'DIVIDER', 'SIGNATURE', 'INITIALS'].includes(field.type);

  // Keep liveSpan in sync when colSpan changes externally (e.g. via config panel)
  useEffect(() => { setLiveSpan(field.colSpan || 6); }, [field.colSpan]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const gridEl = gridRef?.current;
    const cardEl = cardRef.current;
    if (!gridEl || !cardEl) return;

    const gridWidth = gridEl.getBoundingClientRect().width;
    const cardLeft = cardEl.getBoundingClientRect().left;
    const GAP = 12; // gap-3 = 0.75rem = 12px
    const colUnit = (gridWidth - 11 * GAP) / 12;

    let currentSpan = field.colSpan || 6;
    setIsResizing(true);

    const onMove = (ev) => {
      const width = ev.clientX - cardLeft;
      const span = Math.max(2, Math.min(12, Math.round((width + GAP) / (colUnit + GAP))));
      currentSpan = span;
      setLiveSpan(span);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
      onResize(currentSpan);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      style={{ gridColumn: `span ${liveSpan} / span ${liveSpan}` }}
      className="relative"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        ref={cardRef}
        draggable
        onDragStart={onDragStart}
        onClick={onSelect}
        className={`rounded-lg border-2 px-2 py-1.5 cursor-pointer transition-all group relative
          ${isDragging ? 'opacity-40' : ''}
          ${isDragOver ? 'border-indigo-400 shadow-md' : ''}
          ${isSelected
            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
            : field.type === 'LABEL'
              ? 'border-dashed border-gray-200 bg-transparent hover:border-indigo-300'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
          }`}
      >
        {/* Grip — hover-only overlay, takes zero layout space */}
        <GripVertical className="absolute top-1 left-1 w-3 h-3 text-gray-300 cursor-grab
                                  opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        {/* Just the widget — no label row */}
        <FieldPreview field={field} />

        {/* Resize handle — right edge, visible on hover */}
        <div
          onMouseDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize rounded-r-lg
                     flex items-center justify-center opacity-0 group-hover:opacity-100
                     transition-opacity z-10 hover:bg-indigo-100/60"
        >
          <div className="w-0.5 h-5 bg-indigo-400 rounded-full" />
        </div>
      </div>

      {/* Span badge — floats above card while resizing */}
      {isResizing && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 text-white
                        text-[10px] font-mono px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none">
          {liveSpan}/12 · {Math.round((liveSpan / 12) * 100)}%
        </div>
      )}
    </div>
  );
}

const previewInputCls =
  'w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-400 pointer-events-none placeholder-gray-300';

function FieldPreview({ field }) {
  switch (field.type) {
    case 'TEXT_INPUT':
      return <input disabled className={previewInputCls} placeholder={field.placeholder || 'Text input...'} />;
    case 'EMAIL':
      return <input disabled type="email" className={previewInputCls} placeholder={field.placeholder || 'email@example.com'} />;
    case 'PHONE':
      return <input disabled type="tel" className={previewInputCls} placeholder={field.placeholder || '+1 (555) 000-0000'} />;
    case 'NUMBER':
      return <input disabled type="number" className={previewInputCls} placeholder={field.placeholder || '0'} />;
    case 'DATE':
      return <input disabled type="date" className={previewInputCls} />;
    case 'TEXT_AREA':
      return <textarea disabled rows={2} className={`${previewInputCls} resize-none`} placeholder={field.placeholder || 'Text area...'} />;
    case 'DROPDOWN':
      return (
        <select disabled className={previewInputCls}>
          <option>Select an option...</option>
          {(field.options || []).slice(0, 3).map((o) => (
            <option key={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case 'OPTION_BUTTON':
      return (
        <div className="flex flex-wrap gap-1">
          {(field.options || []).slice(0, 3).map((o) => (
            <span key={o.value} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-400 bg-white">
              {o.label}
            </span>
          ))}
        </div>
      );
    case 'CHECKBOX':
      return (
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 border-2 border-gray-300 rounded inline-block flex-shrink-0" />
          <span className="text-xs text-gray-400 truncate">{field.label || 'Checkbox'}</span>
        </div>
      );
    case 'CHECKBOX_GROUP':
      return (
        <div className="space-y-1">
          {(field.options || []).slice(0, 2).map((o) => (
            <div key={o.value} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 rounded inline-block flex-shrink-0" />
              <span className="text-[10px] text-gray-400">{o.label}</span>
            </div>
          ))}
        </div>
      );
    case 'SECTION_HEADER':
      return <div className="border-b-2 border-gray-300 pb-0.5" />;
    case 'PARAGRAPH':
      return <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{field.label || 'Paragraph text...'}</p>;
    case 'LABEL':
      return (
        <span className={`text-sm text-gray-700 ${field.required ? 'font-semibold' : ''}`}>
          {field.label || 'Label'}
        </span>
      );
    case 'SIGNATURE':
      return (
        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-md px-3 py-2 flex items-center gap-2">
          <span className="text-sm text-indigo-400">✍</span>
          <span className="text-xs text-indigo-500 font-medium">Signature (DocuSign)</span>
        </div>
      );
    case 'INITIALS':
      return (
        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-md px-2 py-1.5 inline-flex items-center gap-1.5">
          <span className="text-xs text-indigo-400">✍</span>
          <span className="text-[10px] text-indigo-500 font-medium">Initials</span>
        </div>
      );
    case 'DIVIDER':
      return <div className="border-t border-gray-200 my-0.5" />;
    default:
      return null;
  }
}

