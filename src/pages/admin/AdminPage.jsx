import { NavLink, Outlet, Navigate } from 'react-router-dom'
import {
  Users, Building2, FolderTree, Package, Archive,
  Settings, ClipboardList, UserCircle, Layers,
  GitBranch, Link2, Shield,
} from 'lucide-react'

const TABS = [
  // ── Core entities ──────────────────────────────────────────────────────────
  { label: 'Users',              icon: Users,       path: 'users' },
  { label: 'Customers',          icon: UserCircle,  path: 'customers' },
  { label: 'Departments',        icon: Building2,   path: 'departments' },
  { label: 'Categories',         icon: FolderTree,  path: 'categories' },
  { label: 'Products',           icon: Package,     path: 'products' },
  { label: 'Segments',           icon: Layers,      path: 'segments' },
  { label: 'Product Lines',      icon: GitBranch,   path: 'product-lines' },
  { label: 'Retention',          icon: Archive,     path: 'retention' },
  // ── Platform config ────────────────────────────────────────────────────────
  { label: 'Roles & Permissions',icon: Shield,      path: 'roles' },
  { label: 'Settings',           icon: Settings,    path: 'settings' },
  { label: 'DocuSign',           icon: Link2,       path: 'integrations/docusign' },
  { label: 'Audit Log',          icon: ClipboardList, path: 'audit' },
]

export default function AdminPage() {
  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky tab header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Administration</h1>

        <nav className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
          {TABS.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === 'users'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-lg border-b-2
                 transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
        <Outlet />
      </div>
    </div>
  )
}

export function AdminIndexRedirect() {
  return <Navigate to="users" replace />
}
