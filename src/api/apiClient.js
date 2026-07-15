import axios from 'axios'
import { oktaAuth, fireSessionExpired } from '../utils/oktaConfig'

const apiClient = axios.create({
  //baseURL: 'http://localhost:8080',
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Session expired flag — prevents 401 cascade ──────────────────────────────
// Once we know the session is dead, stop retrying every API call.
let sessionExpiredFired = false

// Reset when user successfully renews (called from SessionWarningModal)
export function resetSessionExpired() {
  sessionExpiredFired = false
}

// ── Attach Okta JWT to every request ────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  // If session is already known to be expired, don't even try
  if (sessionExpiredFired) {
    return Promise.reject(new axios.Cancel('Session expired — awaiting user action'))
  }
  try {
    const token = await oktaAuth.getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    // Token unavailable — let the request proceed; server will return 401
  }
  return config
})

// ── Global response handler ──────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data
    if (
      body !== null &&
      typeof body === 'object' &&
      'success' in body &&
      'data' in body
    ) {
      response.data = body.data
    }
    return response
  },
  async (error) => {
    // Cancelled requests (session expired flag) — swallow silently
    if (axios.isCancel(error)) {
      return new Promise(() => {})
    }

    const status = error.response?.status

    // 401 = token expired or invalid
    if (status === 401) {
      if (sessionExpiredFired) {
        return new Promise(() => {})  // swallow — already handling it
      }

      // One shared renewal attempt across concurrent 401s
      if (!apiClient._renewPromise) {
        apiClient._renewPromise = (async () => {
          try {
            await oktaAuth.tokenManager.renew('accessToken')
            return await oktaAuth.getAccessToken()
          } catch {
            return null
          } finally {
            // Clear after a short delay to batch concurrent 401s
            setTimeout(() => { apiClient._renewPromise = null }, 2000)
          }
        })()
      }

      const newToken = await apiClient._renewPromise
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`
        return apiClient.request(error.config)
      }

      // Renewal truly failed — fire once
      sessionExpiredFired = true
      fireSessionExpired()
      return new Promise(() => {})
    }

    // Surface a clean error message for toast / error boundaries
    const data    = error.response?.data
    const message =
      (typeof data === 'string' ? data : null) ??
      data?.message ??
      data?.detail  ??
      data?.error   ??
      error.message ??
      'Request failed'

    const wrapped    = new Error(message)
    wrapped.status   = status
    wrapped.raw      = error
    return Promise.reject(wrapped)
  }
)

export default apiClient