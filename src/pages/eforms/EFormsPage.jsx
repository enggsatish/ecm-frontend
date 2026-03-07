/**
 * EFormsPage.jsx
 * Route: /eforms
 * Hub page — shows published forms for filling + quick navigation to
 * designer list (admin/designer) and submissions.
 */
import { useNavigate } from 'react-router-dom';
import { PenLine, FileCheck, ClipboardList, Eye, ArrowRight, Loader2 } from 'lucide-react';
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

  // Guard: hooks return T[] but add Array.isArray safety for any edge case
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">eForms</h1>
        <p className="text-sm text-gray-500 mt-0.5">Digital forms for applications, consents, and disclosures</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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

      {/* Available Forms */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Available Forms</h2>
          <span className="text-xs text-gray-400">{publishedForms.length} published</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        ) : publishedForms.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 flex flex-col items-center">
            <span className="text-3xl mb-3">📋</span>
            <p className="text-sm text-gray-500">No published forms available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedForms.map((form) => (
              <FormCard
                key={form.formKey || form.id}
                form={form}
                onFill={() => navigate(`/eforms/fill/${form.formKey}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormCard({ form, onFill }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden">
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-indigo-400" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <PenLine className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-xs font-mono text-gray-400 mt-1">{form.formKey}</span>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">{form.name}</h3>
        {form.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{form.description}</p>
        )}

        {(form.productType || form.formType) && (
          <div className="flex flex-wrap gap-1 mb-4">
            {form.productType && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {form.productType.replace(/_/g, ' ')}
              </span>
            )}
            {form.formType && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {form.formType}
              </span>
            )}
          </div>
        )}

        <button
          onClick={onFill}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium
                     text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50
                     hover:border-indigo-400 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Fill Form
        </button>
      </div>
    </div>
  );
}