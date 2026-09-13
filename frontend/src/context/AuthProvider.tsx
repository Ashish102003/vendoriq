import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../services/api'
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../services/auth/token'
import { AuthContext } from './auth-context'
import type { AuthUser } from '../types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(() => getAccessToken() !== null)

  const clearSession = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  useEffect(() => {
    if (!getAccessToken()) return

    let active = true
    authApi
      .me()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) clearSession()
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [clearSession])

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession()
    }
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    setAccessToken(response.access_token)
    try {
      const currentUser = await authApi.me()
      setUser(currentUser)
    } catch (err) {
      clearAccessToken()
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}