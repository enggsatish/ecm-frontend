/**
 * EFormsPage.jsx
 * Route: /eforms
 * Hub page — shows published forms for filling + quick navigation to
 * designer list (admin/designer) and submissions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, FileCheck, ClipboardList, Eye, ArrowRight, Loader2, Search } from 'lucide-react';
import { usePublishedForms } from '../../hooks/useEForms';
import useUserStore from '../../store/userStore';

const ROLE_ACTIONS = {
  ECM_ADMIN: [
    { label: 'Form Designer',  desc: 'Create and manage forms',    icon: PenLine,       to: '/eforms/designer/list',         color: 'indigo' },
    { label: 'Review Queue',   desc: 'Review submissions',          icon: ClipboardList, to: '/eforms/submissions/queue',     color: 'purple' },
    { label: 'My Submissions', desc: 'Track your submissions',      icon: FileCheck,     to: '/eforms/submissions/mine',      color: 'teal'   },
  ],
  ECM_DESIGNER: [
    { label: 'Form Designer',  desc: 'Create and manage forms',    icon: PenLine,       to: '/eforms/designer/list',         color: 'indigo' },
    { label: 'My Submissions', desc: 'Track your submissions',      icon: FileCheck,     to: '/eforms/submissions/mine',      color: 'teal'   },
  ],
  ECM_BACKOFFICE: [
    { label: 'Review Queue',   desc: 'Review pending submissions',  icon: ClipboardList, to: '/eforms/submissions/queue',     color: 'purple' },
    { label: 'My Submissions', desc: 'Track your submissions',      icon: FileCheck,     to: '/eforms/submissions/mine',      color: 'teal'   },
  ],
  ECM_REVIEWER: [
    { label: 'Review Queue',   desc: 'Review pending submissions',  icon: ClipboardList, to: '/eforms/submissions/queue',     color: 'purple' },
  ],
  DEFAULT: [
    { label: 'My Submissions', desc: 'Track your submissions',      icon: FileCheck,     to: '/eforms/submissions/mine',      color: 'teal'   },
  ],
};

const COLOR_MAP = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  teal:   'bg-teal-50   text-teal-700   border-teal-200',
  blue:   'bg-blue-50   text-blue-700   border-blue-200',
};

export default function EFormsPage() {
  const navigate = useNavigate();
  const { user }  = useUserStore();
  const { data: rawForms, isLoading } = usePublishedForms();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  const publishedForms = Array.isArray(rawForms) ? rawForms : [];

  // Determine role-based quick actions
  const roles = user?.roles || [];
  let quickActions = ROLE_ACTIONS.DEFAULT;
  for (const role of ['ECM_ADMIN', 'ECM_DESIGNER', 'ECM_BACKOFFICE', 'ECM_REVIEWER']) {
    if (roles.includes(`ROLE_${role}`) || roles.includes(role)) {
      quickActions = ROLE_ACTIONS[role];
      break;
    }
  }

  const allTags = [...new Set(publishedForms.flatMap(f => f.tags || []))].sort();

  const filtered = publishedForms
    .filter(f => !selectedTag || (f.tags && f.tags.includes(selectedTag)))
    .filter(f => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return f.name?.toLowerCase().includes(q)
        || f.formKey?.toLowerCase().includes(q)
        || f.description?.toLowerCase().includes(q)
        || (f.tags || []).some(tag => tag.toLowerCase().includes(q));
    });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">eForms</h1>
        <p className="text-sm text-gray-500 mt-0.5">Digital forms for applications, consents, and disclosures</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quickActions.map(({ label, desc, icon: Icon, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`flex items-center gap-4 p-4 rounded-xl border text-left hover:shadow-md transition-all
              ${COLOR_MAP[color] || COLOR_MAP.indigo}`}
          >
            <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs opacity-70 mt-0.5">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 opacity-50 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Available Forms — header + search */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-800">
          Available Forms
          <span className="ml-2 text-xs font-normal text-gray-400">{filtered.length} of {publishedForms.length}</span>
        </h2>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && publishedForms.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-12 flex flex-col items-center">
          <span className="text-3xl mb-3">📋</span>
          <p className="text-sm text-gray-500">No published forms available</p>
        </div>
      )}

      {/* No results */}
      {!isLoading && publishedForms.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          No forms match your search.
        </div>
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Form</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Key</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((form) => (
                <tr key={form.formKey || form.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onDoubleClick={() => navigate(`/eforms/fill/${form.formKey}`)}>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{form.name}</span>
                      {form.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{form.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-gray-500">{form.formKey}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(form.tags || []).map((tag) => (
                        <span key={tag}
                          onClick={(e) => { e.stopPropagation(); setSelectedTag(selectedTag === tag ? null : tag); }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/eforms/fill/${form.formKey}`); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Fill Form
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
