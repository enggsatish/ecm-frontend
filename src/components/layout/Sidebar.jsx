import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect }  from 'react'
import {
  LayoutDashboard, FolderOpen, ClipboardList,
  CheckSquare, Settings, Building2,
  PenLine, FileCheck, Inbox, ChevronDown,
  Users, FolderTree, Package, Archive, GitMerge,
  Layers, GitBranch, ShieldCheck, Link2,
  Bell, Shield, ScanLine, UserCircle, Briefcase,
  Cog, UserCog, Network, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useQuery }     from '@tanstack/react-query'
import useUserStore     from '../../store/userStore'
import useUiStore       from '../../store/uiStore'
import useTenantStore   from '../../store/tenantStore'
import { ROLES, ROLE_GROUPS } from '../../utils/roles'
import { getDashboardCounts } from '../../api/adminApi'

// ─── eForms sub-nav ───────────────────────────────────────────────────────────
const EFORMS_CHILDREN = [
  { path: '/eforms',                    label: 'Overview',      icon: ClipboardList, roles: null,                  exact: true },
  { path: '/eforms/submissions/mine',   label: 'My Submissions',icon: FileCheck,     roles: null },
  { path: '/eforms/designer/list',      label: 'Form Designer', icon: PenLine,       roles: ROLE_GROUPS.DESIGN },
]

// ─── Admin sub-groups (each collapsible) ─────────────────────────────────────
const ADMIN_GROUPS = [
  {
    key: 'people',    label: 'People & Access', icon: UserCog,
    children: [
      { path: '/admin/users',        label: 'Users',              icon: Users,     roles: ROLE_GROUPS.SUPER_ONLY },
      { path: '/admin/roles',        label: 'Roles & Permissions',icon: Shield,    roles: ROLE_GROUPS.SUPER_ONLY },
      { path: '/admin/departments',  label: 'Departments',        icon: Building2, roles: ROLE_GROUPS.SUPER_ONLY },
    ],
  },
  {
    key: 'customers', label: 'Customers', icon: UserCircle,
    children: [
      { path: '/admin/customers',    label: 'Customer Management', icon: UserCircle, roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'catalogue', label: 'Product Catalogue', icon: Package,
    children: [
      { path: '/admin/segments',       label: 'Segments',      icon: Layers,    roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/product-lines',  label: 'Product Lines', icon: GitBranch, roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/products',       label: 'Products',      icon: Package,   roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/categories',     label: 'Categories',    icon: FolderTree,roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'processing', label: 'Processing', icon: Cog,
    children: [
      { path: '/admin/ocr-templates',  label: 'OCR Templates',      icon: ScanLine, roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/retention',       label: 'Retention Policies', icon: Archive,  roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/notifications',   label: 'Notifications',      icon: Bell,     roles: ROLE_GROUPS.ADMIN_OR_SUPER },
      { path: '/admin/email-templates', label: 'Email Templates',    icon: Bell,     roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'integrations', label: 'Integrations', icon: Network,
    children: [
      { path: '/admin/integrations/docusign', label: 'DocuSign', icon: Link2, roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
  {
    key: 'system', label: 'System', icon: Settings,
    children: [
      { path: '/admin/settings',  label: 'Settings',  icon: Settings,    roles: ROLE_GROUPS.SUPER_ONLY },
      { path: '/admin/audit',     label: 'Audit Log', icon: ShieldCheck, roles: ROLE_GROUPS.ADMIN_OR_SUPER },
    ],
  },
]

// Flatten for route matching (used by NavGroup to detect if admin is active)
const ADMIN_CHILDREN = ADMIN_GROUPS.flatMap(g => g.children)

// ─── Top-level nav ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',
    roles: ROLE_GROUPS.ALL,
  },
  {
    path: '/backoffice/queue', icon: Inbox, label: 'Review Queue',
    roles: ROLE_GROUPS.OPERATIONS,
  },
  {
    path: '/documents', icon: FolderOpen, label: 'Documents',
    roles: ROLE_GROUPS.ALL,
  },
  {
    path: '/cases', icon: Briefcase, label: 'Cases',
    roles: ROLE_GROUPS.OPERATIONS,
  },
  {
    path: '/workflow', icon: CheckSquare, label: 'SLA Dashboard',
    roles: ROLE_GROUPS.OPERATIONS,
    exact: true,
  },
  {
    path: '/eforms', icon: ClipboardList, label: 'eForms',
    isGroup: true, groupKey: 'eforms',
    roles: ROLE_GROUPS.ALL,
    children: EFORMS_CHILDREN,
  },
  {
    path: '/workflow/designer', icon: GitMerge, label: 'Workflow Designer',
    roles: ROLE_GROUPS.DESIGN,
  },
  {
    path: '/admin', icon: Settings, label: 'Administration',
    isGroup: true, groupKey: 'admin',
    roles: ROLE_GROUPS.ADMIN_OR_SUPER,
    children: ADMIN_CHILDREN,
    subGroups: ADMIN_GROUPS,
  },
]

function hasRole(userRoles = [], required) {
  if (!required) return true
  return required.some(r => userRoles.includes(r))
}

// Badge pill component
function SidebarBadge({ count, collapsed }) {
  if (!count || count <= 0) return null
  const label = count > 99 ? '99+' : count
  if (collapsed) {
    return (
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center
                        rounded-full bg-red-500 text-white text-[9px] font-bold px-1 shadow-sm">
        {label}
      </span>
    )
  }
  return (
    <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center
                      rounded-full bg-red-500/90 text-white text-[10px] font-bold px-1.5">
      {label}
    </span>
  )
}

export default function Sidebar() {
  const { user }     = useUserStore()
  const location     = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const tenant       = useTenantStore()

  // Poll queue counts every 30s for sidebar badges
  const { data: counts } = useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: getDashboardCounts,
    refetchInterval: 30_000,
    staleTime: 15_000,
    throwOnError: false,
  })

  // Map paths to badge counts
  const badgeCounts = {
    '/backoffice/queue': (counts?.reviewQueueUnclaimed || 0) + (counts?.reviewQueueMine || 0),
    '/cases':            (counts?.casesAssignedToGroup || 0) + (counts?.casesAssignedToMe || 0),
  }

  const isInEForms = location.pathname.startsWith('/eforms')
  const isInAdmin  = location.pathname.startsWith('/admin')

  const [eformsOpen, setEformsOpen] = useState(isInEForms)
  const [adminOpen,  setAdminOpen]  = useState(isInAdmin)

  useEffect(() => { if (isInEForms) setEformsOpen(true) }, [isInEForms])
  useEffect(() => { if (isInAdmin)  setAdminOpen(true)  }, [isInAdmin])

  const visibleItems = NAV_ITEMS.filter(item => hasRole(user?.roles, item.roles))

  const groupState = {
    eforms: { isOpen: eformsOpen, onToggle: () => setEformsOpen(v => !v) },
    admin:  { isOpen: adminOpen,  onToggle: () => setAdminOpen(v => !v)  },
  }

  const collapsed = sidebarCollapsed

  return (
    <div className="relative flex-shrink-0" style={{ zIndex: 20 }}>
    <aside
      className={`flex flex-col h-full transition-all duration-200 ease-in-out
                  ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ background: `linear-gradient(180deg, ${tenant.sidebarBg} 0%, ${tenant.sidebarBg}e6 100%)` }}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div className={`border-b border-white/10 ${collapsed ? 'px-2 pt-4 pb-3' : 'px-5 pt-6 pb-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name}
                 className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-white/10"
                 onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div className={`w-10 h-10 rounded-full bg-accent-500
                          flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-accent-900/40 ${tenant.logoUrl ? 'hidden' : ''}`}>
            <span className="text-white font-bold text-base leading-none select-none">
              {(tenant.name || 'E').charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div>
              <p className="font-bold text-white text-sm leading-tight tracking-wide">{tenant.name}</p>
              <p className="text-[10px] text-white/50 font-medium tracking-widest uppercase mt-0.5">
                Document Management
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <p className="mt-3 text-[10px] text-white/30 italic font-medium leading-relaxed">
            Feel good about your documents.
          </p>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${collapsed ? 'px-1.5' : 'px-3'}`}>
        {visibleItems.map((item) => {
          if (item.isGroup && !collapsed) {
            const { isOpen, onToggle } = groupState[item.groupKey] ?? {}
            return (
              <NavGroup
                key={item.path}
                item={item}
                userRoles={user?.roles}
                isOpen={isOpen}
                onToggle={onToggle}
                currentPath={location.pathname}
              />
            )
          }

          const Icon = item.icon
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)

          if (collapsed) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                title={item.label}
                className={({ isActive: linkActive }) =>
                  `group flex items-center justify-center p-2.5 rounded-lg
                   transition-all duration-150 relative
                   ${linkActive
                     ? 'bg-accent-500 text-white shadow-md shadow-accent-900/30'
                     : 'text-white/60 hover:bg-white/8 hover:text-white'
                   }`
                }
              >
                {({ isActive: linkActive }) => (
                  <>
                    {linkActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2
                                       w-0.5 h-5 bg-white rounded-r-full" />
                    )}
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <SidebarBadge count={badgeCounts[item.path]} collapsed />
                  </>
                )}
              </NavLink>
            )
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive: linkActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg
                 text-sm font-medium transition-all duration-150 relative
                 ${linkActive
                   ? 'bg-accent-500 text-white shadow-md shadow-accent-900/30'
                   : 'text-white/60 hover:bg-white/8 hover:text-white'
                 }`
              }
            >
              {({ isActive: linkActive }) => (
                <>
                  {linkActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2
                                     w-0.5 h-5 bg-white rounded-r-full" />
                  )}
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform
                                    ${linkActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {item.label}
                  <SidebarBadge count={badgeCounts[item.path]} />
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Platform info (expanded only) ──────────────── */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl overflow-hidden"
             style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)' }}>
          <div className="px-3.5 py-3 border border-white/8 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                ECM Platform
              </span>
            </div>
            <p className="text-white/70 font-semibold text-xs leading-snug">
              Secure Document Management
            </p>
            <p className="text-white/30 text-[10px] leading-relaxed mt-1">
              Encrypted at rest. Role-based access control.
            </p>
          </div>
        </div>
      )}
    </aside>

    {/* ── Edge toggle — floating on the sidebar border ── */}
    <button
      onClick={toggleSidebar}
      className="absolute top-1/2 -translate-y-1/2 -right-3 z-10
                 w-6 h-6 rounded-full bg-white border border-gray-200
                 shadow-md flex items-center justify-center
                 text-gray-400 hover:text-gray-700 hover:shadow-lg
                 transition-all duration-150 cursor-pointer"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed
        ? <PanelLeftOpen className="w-3.5 h-3.5" />
        : <PanelLeftClose className="w-3.5 h-3.5" />
      }
    </button>
    </div>
  )
}

// ─── Collapsible nav group ────────────────────────────────────────────────────
function NavGroup({ item, userRoles, isOpen, onToggle, currentPath }) {
  const Icon = item.icon
  const isGroupActive = currentPath.startsWith(item.path)

  const visibleChildren = (item.children || []).filter(child =>
    hasRole(userRoles, child.roles)
  )

  if (visibleChildren.length === 0) return null

  // Calculate total content height for the outer collapse
  const hasSubGroups = item.subGroups && item.subGroups.length > 0
  const totalHeight = hasSubGroups ? 2000 : visibleChildren.length * 44

  return (
    <div>
      <button
        onClick={onToggle}
        className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-all duration-150 relative
                    ${isGroupActive && !isOpen
                      ? 'bg-accent-500/20 text-white'
                      : isOpen
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/8 hover:text-white'
                    }`}
      >
        {isGroupActive && !isOpen && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2
                           w-0.5 h-5 bg-accent-500 rounded-r-full" />
        )}
        <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform
                          ${isOpen ? 'scale-110 text-accent-400' : 'group-hover:scale-105'}`} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0
                      ${isOpen ? 'rotate-180 text-accent-400' : 'text-white/30'}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? `${totalHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        {hasSubGroups ? (
          <div className="ml-3 pl-2 mt-0.5 mb-0.5 space-y-0.5 border-l border-white/10">
            {item.subGroups.map(sg => (
              <SubGroup
                key={sg.key}
                group={sg}
                userRoles={userRoles}
                currentPath={currentPath}
              />
            ))}
          </div>
        ) : (
          <div className="relative ml-3 pl-4 mt-0.5 mb-0.5 space-y-0.5
                          border-l border-white/10">
            {visibleChildren.map(child => (
              <ChildNavLink key={child.path} child={child} currentPath={currentPath} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Collapsible sub-group (within admin) ────────────────────────────────────
function SubGroup({ group, userRoles, currentPath }) {
  const visibleChildren = group.children.filter(child =>
    hasRole(userRoles, child.roles)
  )

  const hasActiveChild = visibleChildren.some(child =>
    currentPath === child.path || currentPath.startsWith(child.path + '/')
  )

  const [open, setOpen] = useState(hasActiveChild)

  useEffect(() => { if (hasActiveChild) setOpen(true) }, [hasActiveChild])

  if (visibleChildren.length === 0) return null

  const GroupIcon = group.icon

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={`group flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg
                    text-[11px] font-semibold uppercase tracking-wider transition-all duration-150
                    ${open
                      ? 'text-white/70'
                      : hasActiveChild
                        ? 'text-accent-400'
                        : 'text-white/30 hover:text-white/50'
                    }`}
      >
        <GroupIcon className="w-3 h-3 flex-shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 flex-shrink-0
                      ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: open ? `${visibleChildren.length * 40}px` : '0px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="ml-2 pl-3 space-y-0.5 border-l border-white/5">
          {visibleChildren.map(child => (
            <ChildNavLink key={child.path} child={child} currentPath={currentPath} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Shared child nav link ───────────────────────────────────────────────────
function ChildNavLink({ child, currentPath }) {
  const ChildIcon = child.icon
  const isActive = child.exact
    ? currentPath === child.path
    : currentPath === child.path || currentPath.startsWith(child.path + '/')

  return (
    <NavLink
      to={child.path}
      end={child.exact}
      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                   text-xs font-medium transition-all duration-150 relative
                   ${isActive
                     ? 'bg-accent-500 text-white shadow-sm shadow-accent-900/30'
                     : 'text-white/50 hover:bg-white/8 hover:text-white/90'
                   }`}
    >
      {isActive && (
        <span className="absolute -left-3 top-1/2 -translate-y-1/2
                         w-2 h-px bg-accent-400" />
      )}
      <ChildIcon className={`w-3.5 h-3.5 flex-shrink-0
                              ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} />
      {child.label}
    </NavLink>
  )
}
