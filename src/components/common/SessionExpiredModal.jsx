/**
 * SessionExpiredModal.jsx
 *
 * FALLBACK modal — shown only when the Okta session is truly dead
 * and SessionWarningModal couldn't recover via renewal.
 *
 * Listens to 'ecm:session-expired' event.
 * Offers "Sign In Again" (redirect to Okta) — no silent renewal possible at this point.
 */
import { useState, useEffect } from 'react'
import { ShieldAlert, LogIn } from 'lucide-react'
import { oktaAuth, SESSION_EXPIRED_EVENT } from '../../utils/oktaConfig'

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => {
      // Only show if SessionWarningModal is NOT already visible
      // (check if warning modal exists in DOM)
      const warningVisible = document.querySelector('[data-session-warning]')
      if (!warningVisible) {
        setVisible(true)
      }
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
  }, [])

  if (!visible) return null

  const handleSignIn = async () => {
    try {
      await oktaAuth.signInWithRedirect({
        originalUri: window.location.pathname + window.location.search
      })
    } catch {
      window.location.reload()
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-red-400 to-red-500" />

        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-500" />
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Your session has expired and could not be renewed.
            Please sign in again to continue.
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
        </div>
      </div>
    </div>
  )
}
