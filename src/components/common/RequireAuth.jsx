import { useOktaAuth } from '@okta/okta-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function RequireAuth({ children }) {
  const { authState, oktaAuth } = useOktaAuth()
  const location = useLocation()

  // CRITICAL — never redirect if we are on the callback page
  // Okta needs to finish processing the token first
  const isCallback = location.pathname === '/login/callback'

  useEffect(() => {
    // Do nothing if:
    // 1. Auth state not loaded yet
    // 2. Already on callback page
    // 3. Already authenticated
    if (!authState || isCallback) return

    if (!authState.isAuthenticated) {
      oktaAuth.signInWithRedirect({
        originalUri: location.pathname
      })
    }
  }, [authState, oktaAuth, isCallback, location.pathname])

  // Show spinner while:
  // - Auth state is loading
  // - On callback page (processing token)
  if (!authState || isCallback) {
    return <LoadingScreen message="Completing sign in..." />
  }

  // Not authenticated and not on callback
  // Show spinner while redirect happens
  if (!authState.isAuthenticated) {
    return <LoadingScreen message="Redirecting to login..." />
  }

  // Authenticated — render the page
  return children
}

function LoadingScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        border: '4px solid #e5e7eb',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '1rem'
      }} />
      <p style={{
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        {message}
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}