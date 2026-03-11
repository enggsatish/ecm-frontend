import { ShieldOff, Mail } from 'lucide-react'
import { useOktaAuth } from '@okta/okta-react'
import useUserStore from '../../store/userStore'

/**
 * Shown when the authenticated user has no ECM roles assigned yet.
 * This happens to new users on first login — ecm-identity provisions
 * them with zero roles; an admin must assign roles via /admin/roles.
 *
 * NOT a redirect — user stays on this page so they can sign out or
 * contact their administrator.
 */
export default function NoAccessPage() {
  const { oktaAuth } = useOktaAuth()
  const { user }     = useUserStore()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-10 text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200
                        flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-amber-500" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Access Not Configured
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">
          Your account <span className="font-medium text-gray-700">{user?.email}</span> has
          been authenticated successfully, but no ECM roles have been assigned yet.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Please contact your system administrator to have your access configured.
        </p>

        {/* Contact hint */}
        <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-3 mb-8 text-left">
          <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Ask your ECM Admin to assign a role to your account in{' '}
            <span className="font-semibold">Administration → Roles & Permissions</span>.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={() => oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin })}
          className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl
                     text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          Sign Out
        </button>

        <p className="text-[11px] text-gray-300 mt-6 italic">
          Servus ECM Platform
        </p>
      </div>
    </div>
  )
}
