import { Bell, HelpCircle, ChevronDown, LogOut, CheckCheck, ExternalLink } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useOktaAuth } from '@okta/okta-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import useUserStore from '../../store/userStore'
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../../api/adminApi'

/**
 * PAGE_META — title + subtitle for every route.
 */
const PAGE_META = {
  '/dashboard':                    { title: 'Dashboard',        sub: 'Your overview and recent activity' },
  '/documents':                    { title: 'Documents',         sub: 'Manage and access organisational documents' },
  '/workflow':                     { title: 'My Tasks',          sub: 'Pending approvals and assignments' },
  '/admin':                        { title: 'Administration',    sub: 'User management and system settings' },

  '/eforms':                       { title: 'eForms',            sub: 'Digital forms and submissions' },
  '/eforms/submissions/mine':      { title: 'My Submissions',    sub: 'Track and manage your submitted forms' },
  '/eforms/designer/list':         { title: 'Form Designer',     sub: 'Create and manage eForm templates' },
  '/eforms/designer/new':          { title: 'New Form',          sub: 'Design a new eForm from scratch' },

  '/admin/users':                  { title: 'Users',             sub: 'Manage platform users and permissions' },
  '/admin/customers':              { title: 'Customers',         sub: 'Customer account management' },
  '/admin/departments':            { title: 'Departments',       sub: 'Organisational department structure' },
  '/admin/categories':             { title: 'Categories',        sub: 'Document category configuration' },
  '/admin/products':               { title: 'Products',          sub: 'Financial product catalogue' },
  '/admin/retention':              { title: 'Retention Policies', sub: 'Document retention and archive rules' },
  '/admin/settings':               { title: 'Settings',          sub: 'Tenant and platform configuration' },
  '/admin/segments':               { title: 'Segments',          sub: 'Business segment hierarchy (Retail, Commercial, SMB)' },
  '/admin/product-lines':          { title: 'Product Lines',     sub: 'Product line classification within segments' },
  '/admin/audit':                  { title: 'Audit Log',         sub: 'System-wide audit trail and activity history' },
  '/admin/ocr-templates':          { title: 'OCR Templates',     sub: 'Manage extraction templates for document categories' },
  '/admin/integrations/docusign':  { title: 'DocuSign Settings', sub: 'Configure DocuSign JWT grant integration' },
  '/admin/notifications':          { title: 'Notification Preferences', sub: 'Manage alert and notification settings' },
  '/admin/roles':                  { title: 'Roles & Permissions', sub: 'Manage roles and fine-grained permissions' },
  '/cases':                        { title: 'Cases',              sub: 'Loan applications, account openings, and document packages' },
  '/backoffice/queue':             { title: 'Review Queue',      sub: 'Unassigned and in-progress review tasks' },
  '/workflow/designer':            { title: 'Workflow Designer', sub: 'Design and publish workflow templates' },
  '/eforms/fill':                  { title: 'Fill Form',         sub: 'Complete and submit an eForm' },
}

function resolveMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
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

function getInitials(displayName) {
  if (!displayName) return '?'
  const parts = displayName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }
  return parts[0].charAt(0).toUpperCase()
}

export default function Header({ pathname }) {
  const { user }          = useUserStore()
  const { oktaAuth }      = useOktaAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef           = useRef(null)
  const meta              = resolveMeta(pathname)
  const initials          = getInitials(user?.displayName)
  const firstName         = user?.displayName?.split(' ')[0] ?? ''
  const isDashboard       = pathname === '/dashboard' || pathname === '/'
  const now               = new Date()
  const dateStr           = now.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr           = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await oktaAuth.signOut()
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100
                       flex items-center justify-between px-6 flex-shrink-0
                       shadow-sm">

      {/* ── Page title ───────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-0.5 h-8 rounded-full bg-accent-500 flex-shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            {isDashboard && firstName ? `Welcome back, ${firstName}` : meta.title}
          </h1>
          <p className="text-[11px] text-gray-400 font-medium hidden sm:block">
            {isDashboard ? `${dateStr} \u00B7 ${timeStr}` : meta.sub}
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
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2.5 pl-1 pr-2.5 py-1.5
                       rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-accent-500
                            flex items-center justify-center
                            text-white text-xs font-bold flex-shrink-0
                            ring-2 ring-accent-200">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight">
                {user?.displayName ?? '—'}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight truncate max-w-[140px]">
                {user?.email ?? ''}
              </p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform hidden sm:block ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-1 overflow-hidden">
              {/* User info section */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.displayName ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{user?.email ?? ''}</p>
                {user?.roles?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {user.roles.map(r => (
                      <span key={r} className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {r.replace('ECM_', '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    throwOnError: false,
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => getNotifications(false),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
    throwOnError: false,
  })

  const markReadMut = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = countData?.unread ?? 0
  const items = Array.isArray(notifications) ? notifications : []

  const handleClick = (notif) => {
    if (!notif.isRead) markReadMut.mutate(notif.id)
    if (notif.link) {
      setOpen(false)
      navigate(notif.link)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                           bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
            {unread > 0 && (
              <button onClick={() => markAllMut.mutate()}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications</p>
              </div>
            ) : (
              items.map(notif => (
                <button key={notif.id} onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notif.isRead ? 'bg-blue-50/30' : ''
                  }`}>
                  <div className="flex items-start gap-2">
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString('en-CA', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : ''}
                      </p>
                    </div>
                    {notif.link && (
                      <ExternalLink size={12} className="text-gray-300 flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
