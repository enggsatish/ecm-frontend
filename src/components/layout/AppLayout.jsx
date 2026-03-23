import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header  from './Header'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import useTenantStore from '../../store/tenantStore'

// Routes where the main area should NOT have its own padding/scroll —
// the page component owns its own layout entirely (e.g. the form designer).
const FULL_HEIGHT_ROUTES = [
  '/eforms/designer/new',
  '/eforms/designer/',   // prefix match — any /eforms/designer/:id
  // Note: /workflow/designer is NOT listed here — the BPMN editor renders as a
  // fixed overlay (TemplateEditor), so the template list page needs normal scrolling.
]

function isFullHeightRoute(pathname) {
  // /eforms/designer/list is a scrollable list page, not a full-height canvas
  if (pathname === '/eforms/designer/list') return false;
  return FULL_HEIGHT_ROUTES.some(r => pathname.startsWith(r))
}

export default function AppLayout() {
  const location = useLocation()
  const { isLoading, isError } = useCurrentUser()
  const fullHeight = isFullHeightRoute(location.pathname)
  const { loaded: tenantLoaded, loadConfig } = useTenantStore()

  // Load tenant config once on app startup
  useEffect(() => {
    if (!tenantLoaded) loadConfig()
  }, [tenantLoaded, loadConfig])

  // ── Loading state ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #002347 0%, #003057 60%, #00A651 100%)' }}
      >
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4
                            border-t-accent-400 border-r-transparent
                            border-b-transparent border-l-transparent
                            animate-spin" />
            <div className="absolute inset-3 rounded-full bg-accent-500
                            flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
          </div>
          <p className="text-white font-semibold text-sm tracking-wide">
            Servus ECM Platform
          </p>
          <p className="text-white/50 text-xs mt-1">Loading your profile…</p>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm mx-4 bg-white rounded-2xl
                        shadow-xl p-8 border border-gray-100">
          <div className="w-14 h-14 rounded-full bg-accent-500
                          flex items-center justify-center mx-auto mb-5
                          shadow-lg shadow-accent-500/30">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Unable to connect to the Servus ECM service. Please ensure
            the identity service is running on port 8080.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2.5 bg-accent-500 text-white
                       rounded-xl text-sm font-semibold
                       hover:bg-accent-600 transition-colors
                       shadow-md shadow-accent-500/25"
          >
            Try Again
          </button>
          <p className="text-[11px] text-gray-400 mt-4 italic">
            Feel good about your money.®
          </p>
        </div>
      </div>
    )
  }

  // ── Authenticated layout ──────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-page-bg, #f4f6f9)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header pathname={location.pathname} />

        {/*
          Two modes:
          - Normal pages: overflow-y-auto + padding — page content scrolls naturally
          - Full-height pages (Form Designer): overflow-hidden, no padding —
            the page component owns its own scroll regions
        */}
        <main className={fullHeight ? 'flex-1 overflow-hidden flex flex-col' : 'flex-1 overflow-y-auto p-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}