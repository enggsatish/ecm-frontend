/**
 * FormDesignerListPage.jsx
 * Route: /eforms/designer/list
 * Lists all form definitions with filters, actions, status badges.
 * Role: ECM_ADMIN, ECM_DESIGNER
 *
 * FIX: ActionMenu now uses fixed positioning (portal-style) calculated from
 * the button's getBoundingClientRect(). This avoids the overflow:hidden
 * clipping that occurs when the dropdown is rendered inside the table container.
 * The table wrapper keeps overflow-hidden for visual correctness (rounded corners
 * clip the table header); the dropdown escapes it by using position:fixed.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Copy, Archive, Eye, Edit, Clock, MoreVertical } from 'lucide-react';
import { useFormDefinitions, useCloneForm, useArchiveForm } from '../../hooks/useEForms';
import StatusBadge from '../../components/eforms/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

const STATUS_FILTERS  = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED', 'DEPRECATED'];

function safeFormatDate(dateStr) {
  try {
    return dateStr ? formatDistanceToNow(new Date(dateStr), { addSuffix: true }) : '—';
  } catch {
    return '—';
  }
}

export default function FormDesignerListPage() {
  const navigate = useNavigate();
  const [statusFilter,  setStatusFilter]  = useState('ALL');
  const [search,        setSearch]        = useState('');
  const [openMenuId,    setOpenMenuId]    = useState(null);
  // Tracks the pixel position of the open dropdown so ActionMenu can use fixed positioning
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const params = {};
  if (statusFilter  !== 'ALL') params.status = statusFilter;

  const { data: rawDefinitions, isLoading } = useFormDefinitions(params);
  const cloneMutation   = useCloneForm();
  const archiveMutation = useArchiveForm();

  const definitions = Array.isArray(rawDefinitions) ? rawDefinitions : [];

  const filtered = definitions.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.formKey?.toLowerCase().includes(q)
    );
  });

  const handleAction = (action, def) => {
    setOpenMenuId(null);
    switch (action) {
      case 'edit':    navigate(`/eforms/designer/${def.id}`); break;
      case 'view':    navigate(`/eforms/designer/${def.id}`); break;
      case 'clone':   cloneMutation.mutate(def.id); break;
      case 'archive': archiveMutation.mutate(def.id); break;
      case 'history': navigate(`/eforms/designer/${def.id}?tab=versions`); break;
      default: break;
    }
  };

  /**
   * Opens the action menu for a row.
   * Uses getBoundingClientRect() on the trigger button so ActionMenu can
   * position itself using fixed coordinates — escaping any overflow:hidden parent.
   */
  const handleOpenMenu = (e, id) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({
      top:   rect.bottom + window.scrollY + 4,   // 4px below the button
      right: window.innerWidth - rect.right,      // align right edge to button right
    });
    setOpenMenuId(id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Form Designer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage eForms for your organisation</p>
        </div>
        <button
          onClick={() => navigate('/eforms/designer/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                     rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'All Status' : s}
            </button>
          ))}
        </div>

      </div>

      {/* Table — overflow-hidden kept for rounded corner clipping of thead background.
          The ActionMenu escapes it via fixed positioning (portal-style). */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading forms...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm font-medium text-gray-600">No forms found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? 'Try a different search term' : 'Create your first form to get started'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Form Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Key</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Version</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Updated</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((def) => (
                <tr key={def.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{def.name}</p>
                      {def.productType && (
                        <p className="text-xs text-gray-400">{def.productType.replace(/_/g, ' ')}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-gray-500">{def.formKey || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500">{def.formType || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-600">v{def.version || 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={def.status} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-gray-400">{safeFormatDate(def.updatedAt)}</span>
                  </td>
                  {/* No relative positioning here — ActionMenu uses fixed coords */}
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => handleOpenMenu(e, def.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">{filtered.length} form{filtered.length !== 1 ? 's' : ''}</p>

      {/* ActionMenu rendered here — OUTSIDE the overflow-hidden table container.
          Uses fixed positioning so it's never clipped by any ancestor. */}
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

/**
 * ActionMenu — uses fixed positioning to escape any overflow:hidden ancestor.
 *
 * Receives {top, right} pixel coordinates calculated from the trigger button's
 * getBoundingClientRect(). Renders at the root of the viewport stacking context.
 *
 * The backdrop div (fixed inset-0) closes the menu on any outside click.
 */
function ActionMenu({ def, pos, onAction, onClose }) {
  const isDraft     = def.status === 'DRAFT';
  const isPublished = def.status === 'PUBLISHED';

  const items = [
    isDraft     && { action: 'edit',    label: 'Edit',            icon: Edit    },
    !isDraft    && { action: 'view',    label: 'View',            icon: Eye     },
    { action: 'history', label: 'Version History', icon: Clock   },
    { action: 'clone',   label: 'Clone',           icon: Copy    },
    isPublished && { action: 'archive', label: 'Archive',         icon: Archive },
  ].filter(Boolean);

  return (
    <>
      {/* Backdrop — closes menu on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu panel — fixed so it's never clipped by overflow:hidden */}
      <div
        className="fixed z-50 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
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