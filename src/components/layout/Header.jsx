import { Bell, HelpCircle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import useUserStore from '../../store/userStore'

/**
 * PAGE_META — title + subtitle for every route.
 *
 * Sprint-C additions:
 *   /admin/segments      → Segments
 *   /admin/product-lines → Product Lines
 *   /admin/audit         → Audit Log
 */
const PAGE_META = {
  // ── Core ──────────────────────────────────────────────────────────────────
  '/dashboard':                    { title: 'Dashboard',        sub: 'Your overview and recent activity' },
  '/documents':                    { title: 'Documents',         sub: 'Manage and access organisational documents' },
  '/workflow':                     { title: 'My Tasks',          sub: 'Pending approvals and assignments' },
  '/admin':                        { title: 'Administration',    sub: 'User management and system settings' },

  // ── eForms ────────────────────────────────────────────────────────────────
  '/eforms':                       { title: 'eForms',            sub: 'Digital forms and submissions' },
  '/eforms/submissions/mine':      { title: 'My Submissions',    sub: 'Track and manage your submitted forms' },
  '/eforms/submissions/queue':     { title: 'Review Queue',      sub: 'Review, approve and reject submissions' },
  '/eforms/designer/list':         { title: 'Form Designer',     sub: 'Create and manage eForm templates' },
  '/eforms/designer/new':          { title: 'New Form',          sub: 'Design a new eForm from scratch' },

  // ── Admin sub-pages ───────────────────────────────────────────────────────
  '/admin/users':                  { title: 'Users',             sub: 'Manage platform users and permissions' },
  '/admin/departments':            { title: 'Departments',       sub: 'Organisational department structure' },
  '/admin/categories':             { title: 'Categories',        sub: 'Document category configuration' },
  '/admin/products':               { title: 'Products',          sub: 'Financial product catalogue' },
  '/admin/customers':              { title: 'Customers',         sub: 'Customer account management' },
  '/admin/retention':              { title: 'Retention Policies', sub: 'Document retention and archive rules' },
  '/admin/settings':               { title: 'Settings',          sub: 'Tenant and platform configuration' },

  // ── Sprint-C additions ────────────────────────────────────────────────────
  '/admin/segments':               { title: 'Segments',          sub: 'Business segment hierarchy (Retail, Commercial, SMB)' },
  '/admin/product-lines':          { title: 'Product Lines',     sub: 'Product line classification within segments' },
  '/admin/audit':                  { title: 'Audit Log',         sub: 'System-wide audit trail and activity history' },
}

/**
 * Resolve the best matching PAGE_META entry for a given pathname.
 * Uses longest-prefix matching so dynamic routes like /eforms/designer/:id
 * and /eforms/fill/:formKey resolve correctly even without exact keys.
 */
function resolveMeta(pathname) {
  // Exact match first
  if (PAGE_META[pathname]) return PAGE_META[pathname]

  // Longest prefix match
  let best = null
  let bestLen = 0
  for (const [key, meta] of Object.entries(PAGE_META)) {
    if (pathname.startsWith(key) && key.length > bestLen) {
      best = meta
      bestLen = key.length
    }
  }
  return best ?? { title: 'ECM Platform', sub: 'Document Management' }
}

export default function Header({ pathname }) {
  const { user }          = useUserStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const meta              = resolveMeta(pathname)
  const initial           = user?.displayName?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <header className="h-16 bg-white border-b border-gray-100
                       flex items-center justify-between px-6 flex-shrink-0
                       shadow-sm">

      {/* ── Page title ───────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        {/* Servus green accent bar */}
        <div className="w-0.5 h-8 rounded-full bg-accent-500 flex-shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            {meta.title}
          </h1>
          <p className="text-[11px] text-gray-400 font-medium hidden sm:block">
            {meta.sub}
          </p>
        </div>
      </div>

      {/* ── Right actions ────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Help */}
        <button
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Help & Support"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotifOpen(v => !v)}
          className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* User chip */}
        <button className="flex items-center gap-2.5 pl-1 pr-2.5 py-1.5
                           rounded-xl hover:bg-gray-100 transition-colors group">
          <div className="w-7 h-7 rounded-full bg-accent-500
                          flex items-center justify-center
                          text-white text-xs font-bold flex-shrink-0
                          ring-2 ring-accent-200">
            {initial}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 leading-tight">
              {user?.displayName ?? '—'}
            </p>
            <p className="text-[10px] text-gray-400 leading-tight">
              {user?.roles?.[0]?.replace('ECM_', '') ?? ''}
            </p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors hidden sm:block" />
        </button>
      </div>
    </header>
  )
}