import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import {
  Users, Building2, FolderTree, Package, Archive,
  Settings, UserCircle, Layers, GitBranch, Shield,
  ShieldCheck, Bell, Cog, UserCog, Network, ChevronRight, Brain,
} from 'lucide-react'
import useUserStore from '../../store/userStore'
import { ROLE_GROUPS } from '../../utils/roles'

// ─── Admin sub-groups (mirrors Sidebar ADMIN_GROUPS) ────────────────────────
const ADMIN_GROUPS = [
  {
    key: 'people', label: 'People & Access', icon: UserCog,
    children: [
      { label: 'Users',               icon: Users,     path: 'users',       roles: ROLE_GROUPS.SUPER_ONLY },
      { label: 'Roles & Permissions', icon: Shield,    path: 'roles',       roles: ROLE_GROUPS.SUPER_ONLY },
      { label: 'Departments',         icon: Building2, path: 'departments', roles: ROLE_GROUPS.SUPER_ONLY },
    ],
  },
  {
    key: 'customers', label: 'Customers', icon: UserCircle,
    children: [
      { label: 'Customer Management', icon: UserCircle, path: 'customers', roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Customer Schema',     icon: Layers,      path: 'customer-schema', roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'catalogue', label: 'Product Catalogue', icon: Package,
    children: [
      { label: 'Segments',      icon: Layers,     path: 'segments',      roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Product Lines', icon: GitBranch,  path: 'product-lines', roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Products',      icon: Package,    path: 'products',      roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Categories',    icon: FolderTree, path: 'categories',    roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'processing', label: 'Processing', icon: Cog,
    children: [
      { label: 'OCR Pipeline',        icon: Brain,    path: 'ocr-pipeline',    roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Retention Policies',  icon: Archive,  path: 'retention',       roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Batch Settings',      icon: Layers,   path: 'batch-settings',  roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Notifications',       icon: Bell,     path: 'notifications',   roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { label: 'Email Templates',     icon: Bell,     path: 'email-templates', roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'system', label: 'System', icon: Settings,
    children: [
      { label: 'Settings',     icon: Settings,    path: 'settings',     roles: ROLE_GROUPS.SUPER_ONLY },
      { label: 'Integrations', icon: Network,     path: 'integrations', roles: ROLE_GROUPS.SUPER_ONLY },
      { label: 'Audit Log',    icon: ShieldCheck, path: 'audit',        roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
]

function hasAccess(userRoles = [], required) {
  if (!required) return true
  return required.some(r => userRoles.includes(r))
}

function findActiveGroup(pathname) {
  const relative = pathname.replace(/^\/admin\/?/, '')
  for (const group of ADMIN_GROUPS) {
    const child = group.children.find(c =>
      relative === c.path || relative.startsWith(c.path + '/')
    )
    if (child) return { group, child }
  }
  return { group: null, child: null }
}

export default function AdminPage() {
  const location = useLocation()
  const { user } = useUserStore()
  const { group: activeGroup, child: activeChild } = findActiveGroup(location.pathname)

  // If no group matched (e.g. /admin root), show all groups as cards
  const GroupIcon = activeGroup?.icon
  const ChildIcon = activeChild?.icon

  const visibleTabChildren = (activeGroup?.children || []).filter(c =>
    hasAccess(user?.roles, c.roles)
  )

  return (
    <div className="flex flex-col h-full">

      {/* ── Header with breadcrumb + sub-tabs ──────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0 border-b border-gray-200 bg-white">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-xl font-semibold text-gray-500">Administration</h1>
          {activeGroup && (
            <>
              <ChevronRight size={16} className="text-gray-300" />
              <div className="flex items-center gap-1.5">
                <GroupIcon size={16} className="text-gray-400" />
                <span className="text-xl font-semibold text-gray-500">{activeGroup.label}</span>
              </div>
            </>
          )}
          {activeChild && (
            <>
              <ChevronRight size={16} className="text-gray-300" />
              <div className="flex items-center gap-1.5">
                <ChildIcon size={16} className="text-blue-600" />
                <span className="text-xl font-semibold text-gray-900">{activeChild.label}</span>
              </div>
            </>
          )}
        </div>

        {/* Sub-tabs — show only the active group's children the user can access */}
        <nav className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
          {activeGroup ? (
            // eslint-disable-next-line no-unused-vars
            visibleTabChildren.map(({ label, icon: Icon, path }) => (
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
            // eslint-disable-next-line no-unused-vars
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
