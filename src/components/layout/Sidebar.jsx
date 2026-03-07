import { NavLink, useLocation } from 'react-router-dom'
import { useOktaAuth } from '@okta/okta-react'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FolderOpen, ClipboardList,
  CheckSquare, Settings, LogOut, Building2,
  PenLine, FileCheck, Inbox, ChevronDown,
  Users, FolderTree, Package, Archive, GitMerge,
  // Sprint-C additions
  Layers, GitBranch, ShieldCheck,
} from 'lucide-react'
import useUserStore from '../../store/userStore'

// ─── eForms sub-nav items ─────────────────────────────────────────────────────
const EFORMS_CHILDREN = [
  {
    path: '/eforms',
    label: 'Overview',
    icon: ClipboardList,
    roles: null,
    exact: true,
  },
  {
    path: '/eforms/submissions/mine',
    label: 'My Submissions',
    icon: FileCheck,
    roles: null,
  },
  {
    path: '/eforms/submissions/queue',
    label: 'Review Queue',
    icon: Inbox,
    roles: ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER'],
  },
  {
    path: '/eforms/designer/list',
    label: 'Form Designer',
    icon: PenLine,
    roles: ['ECM_ADMIN', 'ECM_DESIGNER'],
  },
]

// ─── Admin sub-nav items ──────────────────────────────────────────────────────
const ADMIN_CHILDREN = [
  {
    path: '/admin/users',
    label: 'Users',
    icon: Users,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/departments',
    label: 'Departments',
    icon: Building2,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/categories',
    label: 'Categories',
    icon: FolderTree,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/products',
    label: 'Products',
    icon: Package,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/retention',
    label: 'Retention',
    icon: Archive,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['ECM_ADMIN'],
  },
  // ── Sprint-C additions ────────────────────────────────────────────────────
  {
    path: '/admin/segments',
    label: 'Segments',
    icon: Layers,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/product-lines',
    label: 'Product Lines',
    icon: GitBranch,
    roles: ['ECM_ADMIN'],
  },
  {
    path: '/admin/audit',
    label: 'Audit Log',
    icon: ShieldCheck,
    roles: ['ECM_ADMIN'],
  },
]

// ─── Top-level nav ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    path: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    roles: ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER', 'ECM_DESIGNER', 'ECM_READONLY'],
  },
  {
    path: '/documents',
    icon: FolderOpen,
    label: 'Documents',
    roles: ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER', 'ECM_DESIGNER', 'ECM_READONLY'],
  },
  {
    path: '/eforms',
    icon: ClipboardList,
    label: 'eForms',
    isGroup: true,
    groupKey: 'eforms',
    roles: ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER', 'ECM_DESIGNER', 'ECM_READONLY'],
    children: EFORMS_CHILDREN,
  },
  {
    path: '/workflow',
    icon: CheckSquare,
    label: 'My Tasks',
    roles: ['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER'],
  },
  {
    path: '/workflow/designer',
    icon: GitMerge,
    label: 'Workflow Designer',
    roles: ['ECM_ADMIN', 'ECM_DESIGNER'],
  },
  {
    path: '/admin',
    icon: Settings,
    label: 'Administration',
    isGroup: true,
    groupKey: 'admin',
    roles: ['ECM_ADMIN'],
    children: ADMIN_CHILDREN,
  },
]

const ROLE_LABELS = {
  ECM_ADMIN:      { label: 'Admin',       bg: 'bg-accent-500/20 text-accent-300' },
  ECM_DESIGNER:   { label: 'Designer',    bg: 'bg-accent-500/20 text-accent-300' },
  ECM_BACKOFFICE: { label: 'Back Office', bg: 'bg-primary-700/60 text-primary-200' },
  ECM_REVIEWER:   { label: 'Reviewer',    bg: 'bg-primary-700/60 text-primary-200' },
  ECM_READONLY:   { label: 'Read Only',   bg: 'bg-primary-700/60 text-primary-200' },
}

function hasRole(userRoles = [], required) {
  if (!required) return true
  return required.some(r => userRoles.includes(r))
}

export default function Sidebar() {
  const { user } = useUserStore()
  const { oktaAuth } = useOktaAuth()
  const location = useLocation()

  const isInEForms = location.pathname.startsWith('/eforms')
  const isInAdmin  = location.pathname.startsWith('/admin')

  const [eformsOpen, setEformsOpen] = useState(isInEForms)
  const [adminOpen,  setAdminOpen]  = useState(isInAdmin)

  useEffect(() => { if (isInEForms) setEformsOpen(true) }, [isInEForms])
  useEffect(() => { if (isInAdmin)  setAdminOpen(true)  }, [isInAdmin])

  const handleLogout = async () => {
    await oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin })
  }

  const visibleItems = NAV_ITEMS.filter(item => hasRole(user?.roles, item.roles))

  const initials = user?.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  // Map groupKey → open state + toggle
  const groupState = {
    eforms: { isOpen: eformsOpen, onToggle: () => setEformsOpen(v => !v) },
    admin:  { isOpen: adminOpen,  onToggle: () => setAdminOpen(v => !v)  },
  }

  return (
    <aside
      className="flex flex-col w-64 flex-shrink-0"
      style={{ background: 'linear-gradient(180deg, #002347 0%, #003057 100%)' }}
    >
      {/* ── Servus Logo ──────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-500
                          flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-accent-900/40">
            <span className="text-white font-bold text-base leading-none select-none">S</span>
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight tracking-wide">Servus</p>
            <p className="text-[10px] text-white/50 font-medium tracking-widest uppercase mt-0.5">
              Document Management
            </p>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/30 italic font-medium leading-relaxed">
          Feel good about your documents.
        </p>
      </div>

      {/* ── User profile ─────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-white/10 mx-2 mt-2 rounded-xl bg-white/5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-accent-500
                            flex items-center justify-center
                            text-white text-sm font-bold
                            ring-2 ring-accent-400/40">
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5
                            rounded-full bg-accent-400 border-2 border-primary-900" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.displayName ?? 'Loading…'}
            </p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">{user?.email ?? ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {user?.roles?.map(role => {
            const { label, bg } = ROLE_LABELS[role] ?? {
              label: role.replace('ECM_', ''),
              bg: 'bg-white/10 text-white/60',
            }
            return (
              <span key={role} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg}`}>
                {label}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          if (item.isGroup) {
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
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg
                 text-sm font-medium transition-all duration-150 relative
                 ${isActive
                   ? 'bg-accent-500 text-white shadow-md shadow-accent-900/30'
                   : 'text-white/60 hover:bg-white/8 hover:text-white'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2
                                     w-0.5 h-5 bg-white rounded-r-full" />
                  )}
                  <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-transform
                                    ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Branch info ──────────────────────────────────────── */}
      <div className="mx-3 mb-3 px-3 py-3 rounded-xl bg-white/5 border border-white/8">
        <div className="flex items-center gap-2 text-white/40">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] font-medium tracking-wide uppercase">
            ABC Credit Union
          </span>
        </div>
        <p className="text-[10px] text-white/25 mt-1 leading-relaxed">
          Text to be updated.
        </p>
      </div>

      {/* ── Sign out ─────────────────────────────────────────── */}
      <div className="px-3 pb-5 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                     text-sm text-white/50 hover:bg-white/8 hover:text-white/80
                     transition-all duration-150 group"
        >
          <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ─── Reusable collapsible nav group (used by eForms and Admin) ────────────────
function NavGroup({ item, userRoles, isOpen, onToggle, currentPath }) {
  const Icon = item.icon
  const isGroupActive = currentPath.startsWith(item.path)

  const visibleChildren = (item.children || []).filter(child =>
    hasRole(userRoles, child.roles)
  )

  if (visibleChildren.length === 0) return null

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
          maxHeight: isOpen ? `${visibleChildren.length * 44}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="relative ml-3 pl-4 mt-0.5 mb-0.5 space-y-0.5
                        border-l border-white/10">
          {visibleChildren.map(child => {
            const ChildIcon = child.icon
            const isActive = child.exact
              ? currentPath === child.path
              : currentPath === child.path || currentPath.startsWith(child.path + '/')

            return (
              <NavLink
                key={child.path}
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
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2
                                   w-2 h-px bg-accent-400" />
                )}
                <ChildIcon className={`w-3.5 h-3.5 flex-shrink-0
                                       ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`} />
                {child.label}
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}