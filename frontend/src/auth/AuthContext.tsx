import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  apiFetch,
  setTokens,
  clearTokens,
  getRefreshToken,
  setSessionExpiredHandler,
} from '../api/client'

interface User {
  email: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

const USER_EMAIL_KEY = 'auvi_user_email'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // StrictMode guard — prevents the init effect from running twice in development
  const didInit = useRef(false)

  // Register the session-expired callback so apiFetch can force logout when
  // the refresh token is also expired (e.g. user left tab open for 30 days)
  const handleSessionExpired = useCallback(() => {
    clearTokens()
    localStorage.removeItem(USER_EMAIL_KEY)
    setUser(null)
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired)
  }, [handleSessionExpired])

  // On mount: if we have a refresh token, exchange it for a new access token
  // so the user doesn't need to log in after every page reload
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const refreshToken = getRefreshToken()
    const storedEmail = localStorage.getItem(USER_EMAIL_KEY)

    if (refreshToken && storedEmail) {
      apiFetch<TokenResponse>('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuth: true,
      })
        .then((pair) => {
          setTokens(pair.accessToken, pair.refreshToken)
          setUser({ email: storedEmail })
        })
        .catch(() => {
          // Refresh token expired or revoked — require re-login
          clearTokens()
          localStorage.removeItem(USER_EMAIL_KEY)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const pair = await apiFetch<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    })
    setTokens(pair.accessToken, pair.refreshToken)
    localStorage.setItem(USER_EMAIL_KEY, email)
    setUser({ email })
    // Library hydration is triggered by App.tsx watching the user state change
  }

  const register = async (email: string, password: string, displayName: string): Promise<void> => {
    await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
      skipAuth: true,
    })
    await login(email, password)
  }

  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await apiFetch('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // Clear local state regardless of API errors
      }
    }
    clearTokens()
    localStorage.removeItem(USER_EMAIL_KEY)
    setUser(null)
    // Library clear is triggered by App.tsx watching the user state change
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
