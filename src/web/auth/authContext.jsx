import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { kindeAuth } from './kindeAuth'
import { appEnv } from '../config/env'

const AuthContext = createContext({
  authEnabled: false,
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  getGoogleAccessToken: async () => null,
})

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(appEnv.authEnabled)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      if (!appEnv.authEnabled) {
        if (!isMounted) {
          return
        }

        setLoading(false)
        setIsAuthenticated(false)
        setUser(null)
        return
      }

      try {
        const authenticated = await kindeAuth.isAuthenticated()
        if (!isMounted) {
          return
        }

        setIsAuthenticated(authenticated)
        setUser(authenticated ? await kindeAuth.getUser() : null)
        setError(null)
      } catch (initError) {
        if (!isMounted) {
          return
        }

        setError(initError instanceof Error ? initError.message : 'Failed to initialize authentication')
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async () => {
    setError(null)
    await kindeAuth.login()
  }, [])

  const register = useCallback(async () => {
    setError(null)
    await kindeAuth.register()
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    await kindeAuth.logout()
  }, [])

  const getGoogleAccessToken = useCallback((options = {}) => {
    return kindeAuth.getGoogleAccessToken(options)
  }, [])

  const value = useMemo(
    () => ({
      authEnabled: appEnv.authEnabled,
      isAuthenticated,
      user,
      loading,
      error,
      login,
      register,
      logout,
      getGoogleAccessToken,
    }),
    [error, getGoogleAccessToken, isAuthenticated, loading, login, logout, register, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
