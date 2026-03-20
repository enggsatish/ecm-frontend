import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import {
  Users, Building2, FolderTree, Package, Archive, ScanLine,
  Settings, UserCircle, Layers, GitBranch, Link2, Shield,
  ShieldCheck, Bell, Cog, UserCog, Network, ChevronRight,
} from 'lucide-react'

// ─── Admin sub-groups (mirrors Sidebar ADMIN_GROUPS) ────────────────────────
const ADMIN_GROUPS = [
  {
    key: 'people', label: 'People & Access', icon: UserCog,
    children: [
      { label: 'Users',               icon: Users,     path: 'users' },
      { label: 'Roles & Permissions', icon: Shield,    path: 'roles' },
      { label: 'Departments',         icon: Building2, path: 'departments' },
    ],
  },
  {
    key: 'customers', label: 'Customers', icon: UserCircle,
    children: [
      { label: 'Customer Management', icon: UserCircle, path: 'customers' },
    ],
  },
  {
    key: 'catalogue', label: 'Product Catalogue', icon: Package,
    children: [
      { label: 'Segments',      icon: Layers,     path: 'segments' },
      { label: 'Product Lines', icon: GitBranch,  path: 'product-lines' },
      { label: 'Products',      icon: Package,    path: 'products' },
      { label: 'Categories',    icon: FolderTree, path: 'categories' },
    ],
  },
  {
    key: 'processing', label: 'Processing', icon: Cog,
    children: [
      { label: 'OCR Templates',      icon: ScanLine, path: 'ocr-templates' },
      { label: 'Retention Policies',  icon: Archive,  path: 'retention' },
      { label: 'Notifications',       icon: Bell,     path: 'notifications' },
    ],
  },
  {
    key: 'integrations', label: 'Integrations', icon: Network,
    children: [
      { label: 'DocuSign', icon: Link2, path: 'integrations/docusign' },
    ],
  },
  {
    key: 'system', label: 'System', icon: Settings,
    children: [
      { label: 'Settings',  icon: Settings,    path: 'settings' },
      { label: 'Audit Log', icon: ShieldCheck, path: 'audit' },
    ],
  },
]

function findActiveGroup(pathname) {
  const relative = pathname.replace(/^\/admin\/?/, '')
  for (const group of ADMIN_GROUPS) {
    const match = group.children.some(child =>
      relative === child.path || relative.startsWith(child.path + '/')
    )
    if (match) return group
  }
  return null
}

export default function AdminPage() {
  const location = useLocation()
  const activeGroup = findActiveGroup(location.pathname)

  // If no group matched (e.g. /admin root), show all groups as cards
  const GroupIcon = activeGroup?.icon

  return (
    <div className="flex flex-col h-full">

      {/* ── Header with breadcrumb + sub-tabs ──────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0 border-b border-gray-200 bg-white">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-xl font-semibold text-gray-900">Administration</h1>
          {activeGroup && (
            <>
              <ChevronRight size={16} className="text-gray-300" />
              <div className="flex items-center gap-1.5">
                <GroupIcon size={16} className="text-blue-600" />
                <span className="text-xl font-semibold text-gray-700">{activeGroup.label}</span>
              </div>
            </>
          )}
        </div>

        {/* Sub-tabs — show only the active group's children, or all groups as tabs */}
        <nav className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
          {activeGroup ? (
            activeGroup.children.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                end
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
            ))
          ) : (
            ADMIN_GROUPS.map(({ key, label, icon: Icon, children }) => (
              <NavLink
                key={key}
                to={children[0].path}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-lg border-b-2
                           border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50
                           transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))
          )}
        </nav>
      </div>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
        <Outlet />
      </div>
    </div>
  )
}

export function AdminIndexRedirect() {
  return <Navigate to="users" replace />
}
