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
    autoRenew: true,
    syncStorage: true,
  },
  cookies: {
    secure: false,   // false for localhost http
  },
})

export default oktaAuth
