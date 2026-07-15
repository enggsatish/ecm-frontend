/**
 * SessionWarningModal.jsx
 *
 * With autoRenew:true + offline_access (refresh tokens), the Okta SDK handles
 * token renewal automatically. This modal only appears when:
 *
 *   1. The user has been idle for IDLE_THRESHOLD and the token is about to expire
 *   2. autoRenew failed (refresh token expired or revoked)
 *
 * "Stay Logged In" does a FULL redirect to Okta (not an iframe).
 * Since the Okta session is typically alive, this is instant — no password prompt.
 * This avoids all iframe/third-party cookie issues.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { LogIn, LogOut, Loader2 } from 'lucide-react'
import { oktaAuth } from '../../utils/oktaConfig'
import { resetSessionExpired } from '../../api/apiClient'

const IDLE_THRESHOLD_MS = 10 * 60 * 1000      // 10 min idle before we worry
const WARNING_BEFORE_MS = 90 * 1000            // Show warning when token expires in < 90s
const COUNTDOWN_SECONDS = 60                   // 60 second countdown
const CHECK_INTERVAL_MS = 15 * 1000            // Check every 15s
const LOGIN_GRACE_MS = 3 * 60 * 1000           // Don't warn within 3 min of page load
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
const ACTIVITY_THROTTLE_MS = 10 * 1000

export default function SessionWarningModal() {
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [staying, setStaying] = useState(false)
  const lastActivityRef = useRef(Date.now())
  const lastThrottleRef = useRef(0)
  const checkIntervalRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const mountedAtRef = useRef(Date.now())

  // ── Track user activity (throttled) ──────────────────────────────────
  const handleActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityRef.current = now
      lastThrottleRef.current = now
    }
  }, [])

  // ── Main check loop ──────────────────────────────────────────────────
  const checkSession = useCallback(() => {
    if (visible) return

    const now = Date.now()

    // Grace period after login/page load
    if (now - mountedAtRef.current < LOGIN_GRACE_MS) return

    // Only warn when user is idle
    const idleTime = now - lastActivityRef.current
    if (idleTime < IDLE_THRESHOLD_MS) return

    // Check token expiry
    try {
      const tokens = oktaAuth.tokenManager.getTokensSync()
      const accessToken = tokens?.accessToken
      if (!accessToken?.expiresAt) return

      const expiresAtMs = accessToken.expiresAt * 1000
      const timeUntilExpiry = expiresAtMs - now

      if (timeUntilExpiry > 0 && timeUntilExpiry < WARNING_BEFORE_MS) {
        setCountdown(COUNTDOWN_SECONDS)
        setStaying(false)
        setVisible(true)
      }
    } catch {
      // Token not available — don't panic, autoRenew might fix it
    }
  }, [visible])

  // ── Listen for autoRenew failure ─────────────────────────────────────
  useEffect(() => {
    const handleRenewError = () => {
      const now = Date.now()
      if (now - mountedAtRef.current < LOGIN_GRACE_MS) return
      if (!visible) {
        console.warn('[Session] autoRenew failed — showing warning')
        setCountdown(COUNTDOWN_SECONDS)
        setStaying(false)
        setVisible(true)
      }
    }

    oktaAuth.tokenManager.on('error', handleRenewError)
    return () => oktaAuth.tokenManager.off('error', handleRenewError)
  }, [visible])

  // ── Register activity listeners + check interval ─────────────────────
  useEffect(() => {
    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    )
    checkIntervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, handleActivity)
      )
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [handleActivity, checkSession])

  // ── Countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      return
    }

    countdownIntervalRef.current = setInterval(() => {
      if (staying) return  // freeze while "Stay Logged In" is processing
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current)
          handleLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [visible, staying])

  // ── Stay Logged In ───────────────────────────────────────────────────
  const handleStayLoggedIn = async () => {
    // Freeze countdown and show loading state immediately
    setStaying(true)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    // Try refresh token renewal first (fast, no iframe)
    try {
      const tokens = oktaAuth.tokenManager.getTokensSync()
      if (tokens?.refreshToken) {
        // Refresh token exists — use it directly (no iframe, no cookie needed)
        await oktaAuth.tokenManager.renew('accessToken')
        resetSessionExpired()
        lastActivityRef.current = Date.now()
        mountedAtRef.current = Date.now()
        setVisible(false)
        setStaying(false)
        console.debug('[Session] Renewed via refresh token')
        return
      }
    } catch (err) {
      console.warn('[Session] Refresh token renewal failed:', err.message)
    }

    // Fallback: full redirect to Okta (instant if Okta session alive)
    // This is the ONLY reliable method when refresh tokens aren't available
    // and third-party cookies are blocked (localhost, Safari, incognito)
    console.info('[Session] Redirecting to Okta for re-authentication')
    try {
      await oktaAuth.signInWithRedirect({
        originalUri: window.location.pathname + window.location.search,
      })
    } catch {
      // Last resort
      window.location.reload()
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin })
    } catch {
      sessionStorage.clear()
      window.location.href = '/'
    }
  }

  if (!visible) return null

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div data-session-warning className="fixed inset-0 z-[190] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Warning accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />

        <div className="p-6 text-center">
          {/* Countdown circle */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#f3f4f6" strokeWidth="4" />
              <circle cx="40" cy="40" r="36" fill="none"
                stroke={countdown > 30 ? '#f59e0b' : '#ef4444'}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(countdown / COUNTDOWN_SECONDS) * 226} 226`}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {staying ? (
                <Loader2 size={24} className="animate-spin text-blue-500" />
              ) : (
                <span className={`text-lg font-bold tabular-nums ${countdown > 30 ? 'text-amber-600' : 'text-red-600'}`}>
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1">
            {staying ? 'Renewing Session...' : 'Session Expiring'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {staying
              ? 'Please wait while we extend your session.'
              : 'Your session will expire due to inactivity. Click below to continue working.'
            }
          </p>

          <div className="flex gap-3">
            <button onClick={handleLogout} disabled={staying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                         bg-gray-100 text-gray-600 text-sm font-medium rounded-lg
                         hover:bg-gray-200 disabled:opacity-40 transition-colors">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
            <button onClick={handleStayLoggedIn} disabled={staying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                         bg-blue-600 text-white text-sm font-semibold rounded-lg
                         hover:bg-blue-700 disabled:opacity-70 transition-colors shadow-sm">
              {staying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {staying ? 'Renewing...' : 'Stay Logged In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
