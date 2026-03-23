import axios from 'axios'
import { oktaAuth, fireSessionExpired } from '../utils/oktaConfig'

const apiClient = axios.create({
  //baseURL: 'http://localhost:8080',
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Attach Okta JWT to every request ────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await oktaAuth.getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch (err) {
    // Token unavailable — let the request proceed; server will return 401
    console.warn('Could not attach access token', err.message)
  }
  return config
})

// ── Global response handler ──────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap ApiResponse<T> envelope automatically.
    // Backend always sends: { success: boolean, data: T, message: string }
    // After unwrap: response.data = T  (the actual payload)
    // This prevents every caller from needing to do r.data?.data manually.
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
    const status = error.response?.status

    // 401 = token expired or invalid
    if (status === 401) {
      // Only attempt renewal if we had a token (not pre-login 401s)
      const existingToken = await oktaAuth.getAccessToken().catch(() => null)
      if (existingToken) {
        try {
          await oktaAuth.tokenManager.renew('accessToken')
          const newToken = await oktaAuth.getAccessToken()
          if (newToken) {
            error.config.headers.Authorization = `Bearer ${newToken}`
            return apiClient.request(error.config)
          }
        } catch (renewErr) {
          // Renewal failed — show session expired modal
          fireSessionExpired()
          return new Promise(() => {})
        }
      }
      // No existing token — this is a pre-login 401, let Okta handle it
      await oktaAuth.signInWithRedirect().catch(() => {})
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