/**
 * SessionExpiredModal.jsx
 *
 * Shown when the user's auth session expires and silent renewal fails.
 * Instead of a hard redirect to Okta login (which loses page context),
 * this modal preserves the current URL and lets the user sign in again.
 *
 * Listens to the 'ecm:session-expired' custom event fired by:
 *   - oktaConfig.js (token renewal failure)
 *   - apiClient.js (401 after failed renewal attempt)
 */
import { useState, useEffect } from 'react'
import { ShieldAlert, LogIn } from 'lucide-react'
import { oktaAuth, SESSION_EXPIRED_EVENT } from '../../utils/oktaConfig'

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener(SESSION_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
  }, [])

  if (!visible) return null

  const handleSignIn = async () => {
    try {
      // signInWithRedirect preserves the current URL as the return path
      await oktaAuth.signInWithRedirect({ originalUri: window.location.pathname + window.location.search })
    } catch (err) {
      console.error('Redirect to login failed', err)
      // Fallback: hard reload
      window.location.reload()
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />

        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-amber-500" />
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Your session has expired due to inactivity. Sign in again to continue
            where you left off — your work on this page is preserved.
          </p>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                       bg-blue-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-blue-700 transition-colors shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            Sign In Again
          </button>

          <p className="text-[10px] text-gray-400 mt-3">
            You'll be redirected to your identity provider
          </p>
        </div>
      </div>
    </div>
  )
}
