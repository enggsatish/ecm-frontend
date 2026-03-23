/**
 * FormDesignerListPage.jsx
 * Route: /eforms/designer/list
 * Lists all form definitions with tabs, search, tag filter, and row actions.
 * Role: ECM_ADMIN, ECM_DESIGNER
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Copy, Archive, Eye, Edit, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { useFormDefinitions, useCloneForm, useArchiveForm } from '../../hooks/useEForms';
import StatusBadge from '../../components/eforms/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

function safeFormatDate(dateStr) {
  try {
    return dateStr ? formatDistanceToNow(new Date(dateStr), { addSuffix: true }) : '—';
  } catch {
    return '—';
  }
}

// ── Action Menu (dropdown) ────────────────────────────────────────────────
function ActionMenu({ def, pos, onAction, onClose }) {
  const isDraft     = def.status === 'DRAFT';
  const isPublished = def.status === 'PUBLISHED';

  const items = [
    isDraft     && { action: 'edit',    label: 'Edit',    icon: Edit    },
    !isDraft    && { action: 'view',    label: 'View',    icon: Eye     },
    { action: 'clone',   label: 'Clone',   icon: Copy    },
    isPublished && { action: 'archive', label: 'Archive', icon: Archive },
  ].filter(Boolean);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-40 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
        style={{ top: pos.top, right: pos.right }}
      >
        {items.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            onClick={() => onAction(action, def)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-gray-400" />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function FormDesignerListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const { data: rawDefinitions, isLoading } = useFormDefinitions(
    statusFilter !== 'ALL' ? { status: statusFilter } : {}
  );
  const cloneMutation   = useCloneForm();
  const archiveMutation = useArchiveForm();

  const definitions = Array.isArray(rawDefinitions) ? rawDefinitions : [];

  // All definitions (unfiltered by status tab) for tag collection —
  // we use the definitions array which is already filtered by status via API param.
  // For tag counts across all statuses, we'd need a separate query.
  // For now, tags are collected from the current result set.
  const allTags = [...new Set(definitions.flatMap(d => d.tags || []))].sort();

  const TABS = [
    { key: 'ALL',        label: 'All' },
    { key: 'DRAFT',      label: 'Drafts' },
    { key: 'PUBLISHED',  label: 'Published' },
    { key: 'ARCHIVED',   label: 'Archived' },
    { key: 'DEPRECATED', label: 'Deprecated' },
  ];

  const filtered = definitions
    .filter(d => !selectedTag || (d.tags && d.tags.includes(selectedTag)))
    .filter(d => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return d.name?.toLowerCase().includes(q)
        || d.formKey?.toLowerCase().includes(q)
        || d.description?.toLowerCase().includes(q)
        || (d.tags || []).some(tag => tag.toLowerCase().includes(q));
    });

  const handleAction = (action, def) => {
    setOpenMenuId(null);
    switch (action) {
      case 'edit':    navigate(`/eforms/designer/${def.id}`); break;
      case 'view':    navigate(`/eforms/designer/${def.id}`); break;
      case 'clone':   cloneMutation.mutate(def.id); break;
      case 'archive': archiveMutation.mutate(def.id); break;
      default: break;
    }
  };

  const handleOpenMenu = (e, id) => {
    if (openMenuId === id) { setOpenMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({
      top:   rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
    setOpenMenuId(id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Form Designer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage eForms for your organisation</p>
        </div>
        <button onClick={() => navigate('/eforms/designer/new')}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm">
          <Plus size={15} /> New Form
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-200">
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => { setStatusFilter(key); setSelectedTag(null); }}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors
                ${statusFilter === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative mb-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms or tags..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Tags:</span>
          <button onClick={() => setSelectedTag(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
              ${!selectedTag ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {allTags.map((tag) => (
            <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                ${selectedTag === tag ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          Loading forms...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && definitions.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <span className="text-4xl mb-3 block">📋</span>
          <p className="text-gray-600 font-semibold">No forms found</p>
          <p className="text-sm text-gray-400 mt-1">Create your first form to get started</p>
          <button onClick={() => navigate('/eforms/designer/new')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={15} /> New Form
          </button>
        </div>
      )}

      {/* No results for current filter */}
      {!isLoading && definitions.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          No forms match your filter.
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Form Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Key</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Ver</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Updated</th>
                <th className="w-10 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((def) => {
                const isDraft = def.status === 'DRAFT';
                return (
                  <tr key={def.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onDoubleClick={() => navigate(`/eforms/designer/${def.id}`)}>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{def.name}</span>
                        {def.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{def.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-gray-500 truncate block max-w-[160px]">{def.formKey || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={def.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(def.tags || []).map((tag) => (
                          <span key={tag}
                            onClick={(e) => { e.stopPropagation(); setSelectedTag(selectedTag === tag ? null : tag); }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-400">v{def.version || 1}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-400">{safeFormatDate(def.updatedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenMenu(e, def.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!isLoading && definitions.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {definitions.length} forms
        </div>
      )}

      {/* ActionMenu rendered outside the overflow-hidden table container */}
      {openMenuId && (() => {
        const def = filtered.find(d => d.id === openMenuId);
        return def ? (
          <ActionMenu
            def={def}
            pos={menuPos}
            onAction={handleAction}
            onClose={() => setOpenMenuId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
