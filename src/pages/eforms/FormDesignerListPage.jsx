/**
 * FormDesignerListPage.jsx
 * Route: /eforms/designer/list
 * Lists all form definitions with filters, actions, status badges.
 * Role: ECM_ADMIN, ECM_DESIGNER
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Copy, Archive, Eye, Edit, Clock, MoreVertical } from 'lucide-react';
import { useFormDefinitions, useCloneForm, useArchiveForm } from '../../hooks/useEForms';
import StatusBadge from '../../components/eforms/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

const STATUS_FILTERS  = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED', 'DEPRECATED'];
const PRODUCT_TYPES   = ['ALL', 'MORTGAGE', 'AUTO_LOAN', 'PERSONAL_LOAN', 'CREDIT_CARD', 'BUSINESS_LOAN'];

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
  const [productFilter, setProductFilter] = useState('ALL');
  const [search,        setSearch]        = useState('');
  const [openMenuId,    setOpenMenuId]    = useState(null);

  const params = {};
  if (statusFilter  !== 'ALL') params.status      = statusFilter;
  if (productFilter !== 'ALL') params.productType = productFilter;

  const { data: rawDefinitions, isLoading } = useFormDefinitions(params);
  const cloneMutation   = useCloneForm();
  const archiveMutation = useArchiveForm();

  // Guard: hooks return T[] but add Array.isArray safety for any edge case
  const definitions = Array.isArray(rawDefinitions) ? rawDefinitions : [];

  const filtered = definitions.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.formKey?.toLowerCase().includes(q) ||
      d.formType?.toLowerCase().includes(q)
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

        {/* Product type filter */}
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2
                     focus:outline-none focus:border-indigo-400"
        >
          {PRODUCT_TYPES.map((pt) => (
            <option key={pt} value={pt}>{pt === 'ALL' ? 'All Products' : pt.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
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
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === def.id ? null : def.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === def.id && (
                      <ActionMenu def={def} onAction={handleAction} onClose={() => setOpenMenuId(null)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">{filtered.length} form{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

function ActionMenu({ def, onAction, onClose }) {
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
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-8 z-20 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 overflow-hidden">
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