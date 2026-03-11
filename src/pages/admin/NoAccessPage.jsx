import { useOktaAuth } from '@okta/okta-react'
import { ShieldOff, Mail } from 'lucide-react'

/**
 * Shown when a user has authenticated successfully with Okta but has
 * not been assigned any ECM roles yet (ECM_NO_ACCESS response from the gateway).
 *
 * No redirect loop — this page renders in place and provides clear
 * instructions for the user to contact their administrator.
 */
export default function NoAccessPage() {
  const { oktaAuth } = useOktaAuth()

  const handleSignOut = async () => {
    try {
      await oktaAuth.signOut()
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full
                        bg-amber-50 border border-amber-100 mb-5">
          <ShieldOff className="w-8 h-8 text-amber-500" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Access Not Configured
        </h1>

        {/* Sub-heading */}
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your account has been authenticated, but no ECM roles have been
          assigned to it yet.
        </p>

        {/* Contact card */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
            What to do
          </p>
          <p className="text-sm text-blue-800 leading-relaxed">
            Contact your ECM Administrator and ask them to assign you a role
            via the Admin → Users panel.
          </p>
        </div>

        {/* Sign out button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                     rounded-lg border border-gray-200 text-sm text-gray-600
                     hover:bg-gray-50 transition-colors"
        >
          Sign out and try a different account
        </button>
      </div>
    </div>
  )
}
