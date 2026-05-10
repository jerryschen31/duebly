import createKindeClient from '@kinde-oss/kinde-auth-pkce-js'
import { appConfig } from '../config/env'

let clientPromise = null

const replacePathAndNotify = (path) => {
  window.history.replaceState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const isKindeHostedDomain = (domain) => {
  try {
    return new URL(domain).hostname.endsWith('.kinde.com')
  } catch {
    return false
  }
}

export const getKindeClient = () => {
  if (!appConfig.authEnabled || !appConfig.kinde.configured) {
    return null
  }

  if (!clientPromise) {
    clientPromise = createKindeClient({
      client_id: appConfig.kinde.clientId,
      domain: appConfig.kinde.domain,
      redirect_uri: appConfig.kinde.redirectUri,
      logout_uri: appConfig.kinde.logoutUri,
      scope: appConfig.kinde.scope,
      audience: appConfig.kinde.audience || undefined,
      is_dangerously_use_local_storage: isKindeHostedDomain(appConfig.kinde.domain),
      on_redirect_callback: (_user, appState = {}) => {
        const returnTo = typeof appState.returnTo === 'string' ? appState.returnTo : '/'
        replacePathAndNotify(returnTo.startsWith('/') ? returnTo : '/')
      },
      on_error_callback: () => {
        if (import.meta.env.DEV) {
          console.warn('Kinde auth redirect failed')
        }
        replacePathAndNotify('/login')
      },
    })
  }

  return clientPromise
}

export const initializeAuthSession = async () => {
  const client = await getKindeClient()
  if (!client) {
    return {
      enabled: false,
      isAuthenticated: false,
      user: null,
    }
  }

  const isAuthenticated = await client.isAuthenticated()
  const user = isAuthenticated ? await client.getUserProfile() : null
  return {
    enabled: true,
    isAuthenticated,
    user,
  }
}

export const login = async () => {
  const client = await getKindeClient()
  if (client) {
    await client.login({ app_state: { returnTo: '/' } })
  }
}

export const register = async () => {
  const client = await getKindeClient()
  if (client) {
    await client.register({ app_state: { returnTo: '/' } })
  }
}

export const logout = async () => {
  const client = await getKindeClient()
  if (client) {
    await client.logout()
  }
}

export const getAccessToken = async () => {
  const client = await getKindeClient()
  if (!client) {
    return null
  }
  try {
    if (typeof client.getToken === 'function') {
      const token = await client.getToken()
      if (typeof token === 'string' && token) {
        return token
      }
      if (token && typeof token === 'object') {
        const objectToken = token.access_token || token.accessToken || token.token
        if (typeof objectToken === 'string' && objectToken) {
          return objectToken
        }
      }
    }
  } catch {
    if (import.meta.env.DEV) {
      console.warn('Failed to retrieve Kinde access token')
    }
  }
  return null
}
