// ─────────────────────────────────────────────────────────────────────────────
// Token storage
//
// Access token: memory only — never written to localStorage.
//   Reason: localStorage is readable by any JS on the page (XSS / supply-chain).
//   Trade-off: lost on page reload, but restored via refresh token automatically.
//
// Refresh token: localStorage — long-lived, survives page reload.
//   A compromised refresh token requires a network round-trip to exploit, giving
//   the server a chance to detect and revoke it via rotation.
// ─────────────────────────────────────────────────────────────────────────────

const REFRESH_KEY = 'auvi_refresh_token'

let memoryAccessToken: string | null = null

// Invoked when both tokens are expired (refresh fails). AuthContext registers
// this to redirect the user to the login screen.
let sessionExpiredHandler: (() => void) | null = null

// Deduplicates concurrent refresh attempts — one in-flight promise shared by all callers.
let pendingRefresh: Promise<string> | null = null

export function setTokens(access: string, refresh: string): void {
  memoryAccessToken = access
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  memoryAccessToken = null
  localStorage.removeItem(REFRESH_KEY)
}

export function getAccessToken(): string | null {
  return memoryAccessToken
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

/** Register a callback invoked when the refresh token is also expired/invalid.
 *  AuthContext calls this to force the user back to the login screen. */
export function setSessionExpiredHandler(cb: () => void): void {
  sessionExpiredHandler = cb
}

/** Stream path WITHOUT token — token appended at play time in Player.tsx so it's always fresh. */
export function buildStreamPath(trackId: string): string {
  return `/api/v1/tracks/${trackId}/stream`
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token refresh (shared promise to deduplicate concurrent 401s)
// ─────────────────────────────────────────────────────────────────────────────

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

async function refreshAccessToken(): Promise<string> {
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new ApiError(401, 'NO_TOKEN', 'No refresh token available')

    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      throw new ApiError(res.status, 'REFRESH_FAILED', 'Session expired')
    }

    const body = await res.json() as { success: true; data: TokenResponse }
    setTokens(body.data.accessToken, body.data.refreshToken)
    return body.data.accessToken
  })()

  try {
    return await pendingRefresh
  } finally {
    pendingRefresh = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean; _isRetry?: boolean },
): Promise<T> {
  const { skipAuth, _isRetry, ...fetchOptions } = options ?? {}
  const headers = new Headers(fetchOptions.headers)

  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  // Don't set Content-Type for FormData — browser sets it with the multipart boundary
  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, { ...fetchOptions, headers })

  // 401 → try refresh, then retry the original request once
  if (res.status === 401 && !skipAuth && !_isRetry) {
    try {
      await refreshAccessToken()
    } catch {
      // Refresh failed — session is fully expired
      clearTokens()
      sessionExpiredHandler?.()
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.')
    }
    return apiFetch<T>(path, { ...options, _isRetry: true })
  }

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR'
    let message = res.statusText
    try {
      const body = await res.json() as { success: false; error: { code: string; message: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, code, message)
  }

  const body = await res.json() as { success: true; data: T }
  return body.data
}
