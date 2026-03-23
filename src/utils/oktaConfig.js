import { OktaAuth } from '@okta/okta-auth-js'

const issuer   = import.meta.env.VITE_OKTA_ISSUER
const clientId = import.meta.env.VITE_OKTA_CLIENT_ID

if (!issuer || !clientId) {
  console.error(
    '❌ Missing Okta environment variables!\n' +
    'VITE_OKTA_ISSUER: '    + (issuer   ?? 'MISSING') + '\n' +
    'VITE_OKTA_CLIENT_ID: ' + (clientId ?? 'MISSING')
  )
}

// NOTE: restoreOriginalUri is intentionally NOT set here.
// It is passed as a prop on the <Security> component in App.jsx.
// Setting it in both places triggers a console warning from okta-react.
export const oktaAuth = new OktaAuth({
  issuer,
  clientId,
  redirectUri: window.location.origin + '/login/callback',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
  responseType: 'code',
  tokenManager: {
    storage: 'sessionStorage',
    autoRenew: true,           // silently renew tokens before expiry
    expireEarlySeconds: 300,   // start renewal 5 minutes before expiry
    syncStorage: true,
  },
  cookies: {
    secure: false,   // false for localhost http; set true in production
  },
})

// ── Session expiry event bus ──────────────────────────────────────────────
// Components can listen for 'ecm:session-expired' to show a modal instead
// of the hard redirect to Okta login.
//
// Fired when:
//   1. autoRenew fails (Okta session truly dead)
//   2. 401 response from API (token invalid/expired and renewal failed)

export const SESSION_EXPIRED_EVENT = 'ecm:session-expired'

function fireSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

// Listen for token renewal failures from Okta SDK
oktaAuth.tokenManager.on('error', (err) => {
  // 'login_required' means the Okta session is dead — can't silently renew
  if (err?.errorCode === 'login_required' || err?.message?.includes('login_required')) {
    console.warn('[OktaAuth] Silent renewal failed — Okta session expired')
    fireSessionExpired()
  }
})

// Also fire on token removal (expired and couldn't renew)
oktaAuth.tokenManager.on('expired', (key) => {
  if (key === 'accessToken') {
    console.warn('[OktaAuth] Access token expired — attempting renewal')
    // autoRenew will try to renew. If it fails, the 'error' handler above fires.
  }
})

export { fireSessionExpired }
export default oktaAuth
