/**
 * FieldPalette.jsx
 * Left panel of the Form Designer.
 * Shows draggable field type tiles. Uses HTML5 drag API (no extra lib needed).
 */
import {
  Type, AlignLeft, Hash, Mail, Phone, Calendar,
  ChevronDown, ToggleLeft, CheckSquare, List,
  Minus, Square, SeparatorHorizontal,
} from 'lucide-react';

const FIELD_GROUPS = [
  {
    group: 'Input Fields',
    items: [
      { type: 'TEXT_INPUT',    label: 'Text Input',     icon: Type },
      { type: 'TEXT_AREA',     label: 'Text Area',      icon: AlignLeft },
      { type: 'NUMBER',        label: 'Number',         icon: Hash },
      { type: 'EMAIL',         label: 'Email',          icon: Mail },
      { type: 'PHONE',         label: 'Phone',          icon: Phone },
      { type: 'DATE',          label: 'Date',           icon: Calendar },
    ],
  },
  {
    group: 'Selection Fields',
    items: [
      { type: 'DROPDOWN',      label: 'Dropdown',       icon: ChevronDown },
      { type: 'OPTION_BUTTON', label: 'Option Buttons', icon: ToggleLeft },
      { type: 'CHECKBOX',      label: 'Checkbox',       icon: CheckSquare },
      { type: 'CHECKBOX_GROUP',label: 'Checkbox Group', icon: List },
    ],
  },
  {
    group: 'Layout',
    items: [
      { type: 'SECTION_HEADER',label: 'Section Header', icon: Square },
      { type: 'PARAGRAPH',     label: 'Paragraph',      icon: AlignLeft },
      { type: 'DIVIDER',       label: 'Divider',        icon: SeparatorHorizontal },
    ],
  },
];

function PaletteTile({ item }) {
  const Icon = item.icon;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/ecm-field-type', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white
                 hover:border-indigo-300 hover:bg-indigo-50 cursor-grab active:cursor-grabbing
                 transition-colors select-none group"
      title={`Drag to add ${item.label}`}
    >
      <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" />
      <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-700 truncate">
        {item.label}
      </span>
    </div>
  );
}

export default function FieldPalette({ style }) {
  return (
    <aside className="flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col"
           style={{ width: 208, ...style }}>
      <div className="px-3 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Field Types</p>
        <p className="text-xs text-gray-400 mt-0.5">Drag onto canvas</p>
      </div>

      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        {FIELD_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 px-1">
              {group.group}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <PaletteTile key={item.type} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}