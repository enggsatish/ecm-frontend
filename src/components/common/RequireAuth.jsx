import { useOktaAuth } from '@okta/okta-react'
import { useEffect }   from 'react'
import { useLocation } from 'react-router-dom'
import useUserStore    from '../../store/userStore'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import NoAccessPage    from '../../pages/common/NoAccessPage'
import { ROLES }       from '../../utils/roles'

/**
 * RequireAuth — guards all protected routes.
 *
 * Flow:
 *  1. Not authenticated                 → redirect to Okta login
 *  2. Authenticated, user API loading   → spinner
 *  3. Authenticated, user API error     → AccountErrorPage (with logout)
 *     This covers: account inactive (is_active=false → 403 from gateway),
 *     or any other API failure that leaves user=null indefinitely.
 *  4. Authenticated, user loaded, no ECM roles → NoAccessPage (with logout)
 *  5. Authenticated, has roles          → render children
 *
 * WHY we must handle the error case here:
 *   If /api/auth/me returns 403 (e.g. invited user whose account is still
 *   pending), useCurrentUser's query errors and user stays null forever.
 *   Without this check, RequireAuth falls through to `return children`,
 *   AppLayout renders, all its API calls also 403, the page is broken,
 *   and the user has NO way to sign out because the normal layout never mounts.
 */
export default function RequireAuth({ children }) {
  const { authState, oktaAuth } = useOktaAuth()
  const { user }                = useUserStore()
  const location                = useLocation()

  // Pull loading/error state from the user query
  const { isLoading: userLoading, isError: userError, error: userErrorObj } = useCurrentUser()

  const isCallback = location.pathname === '/login/callback'

  useEffect(() => {
    if (!authState || isCallback) return
    if (!authState.isAuthenticated) {
      oktaAuth.signInWithRedirect({ originalUri: location.pathname })
    }
  }, [authState, oktaAuth, isCallback, location.pathname])

  // Auth state still initialising or on callback page
  if (!authState || isCallback) {
    return <LoadingScreen message="Completing sign in…" />
  }

  // Not authenticated — spinner while redirect kicks in
  if (!authState.isAuthenticated) {
    return <LoadingScreen message="Redirecting to login…" />
  }

  // Authenticated but user profile still loading
  if (userLoading && !user) {
    return <LoadingScreen message="Loading your profile…" />
  }

  // Authenticated but /api/auth/me errored
  // Most common cause: account is inactive (is_active=false) → gateway returns
  // NO_ACCESS → enrichment returns 403 to the frontend.
  if (userError && !user) {
    const status = userErrorObj?.response?.status
    return <AccountErrorPage status={status} />
  }

  // Still no user after loading completed without explicit error
  // (edge case — API returned empty / unexpected shape)
  if (!user) {
    return <LoadingScreen message="Loading your profile…" />
  }

  // Authenticated but no ECM roles assigned — admin must assign via Roles & Permissions
  const knownRoles = Object.values(ROLES)
  const hasAnyKnownRole = user.roles?.some(r => knownRoles.includes(r)) ?? false

  if (!hasAnyKnownRole) {
    return <NoAccessPage />
  }

  return children
}

// ── Account Error Page ────────────────────────────────────────────────────────
// Shown when the user authenticated via Okta but /api/auth/me failed.
// Provides clear messaging + a working Sign Out button.

function AccountErrorPage({ status }) {
  const { oktaAuth } = useOktaAuth()

  const handleSignOut = async () => {
    try {
      await oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin })
    } catch {
      window.location.href = '/'
    }
  }

  // 403 = inactive account or no access from gateway enrichment
  const isInactive = status === 403

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      padding: '1rem',
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: '1rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        border: '1px solid #f0f0f0',
        padding: '2.5rem',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '4rem', height: '4rem', borderRadius: '50%',
          backgroundColor: '#fef3c7', border: '2px solid #fde68a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '1.75rem',
        }}>
          {isInactive ? '🔒' : '⚠️'}
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
          {isInactive ? 'Account Not Yet Active' : 'Unable to Load Profile'}
        </h1>

        <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {isInactive
            ? 'Your account has been created but is not yet active. ' +
              'Please contact your ECM Administrator to activate your account.'
            : 'We could not load your account profile. ' +
              'This may be a temporary issue — please try signing out and back in.'
          }
        </p>

        {/* Info box */}
        <div style={{
          backgroundColor: '#eff6ff', border: '1px solid #dbeafe',
          borderRadius: '0.75rem', padding: '0.75rem 1rem',
          marginBottom: '1.5rem', textAlign: 'left',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#1d4ed8', lineHeight: 1.5 }}>
            {isInactive
              ? 'Ask your administrator to activate your account in Administration → Users.'
              : 'If the problem persists, contact your system administrator.'
            }
          </p>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '0.625rem 1rem',
            backgroundColor: '#111827', color: '#fff',
            border: 'none', borderRadius: '0.625rem',
            fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.target.style.backgroundColor = '#374151'}
          onMouseLeave={e => e.target.style.backgroundColor = '#111827'}
        >
          Sign Out
        </button>

        <p style={{ fontSize: '0.7rem', color: '#d1d5db', marginTop: '1.5rem', fontStyle: 'italic' }}>
          Servus ECM Platform
        </p>
      </div>
    </div>
  )
}

function LoadingScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        border: '4px solid #e5e7eb',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '1rem',
      }} />
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}