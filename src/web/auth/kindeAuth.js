import createKindeClient from '@kinde-oss/kinde-auth-pkce-js'
import { appConfig } from '../config/env'

let clientPromise = null

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
      is_dangerously_use_local_storage: isKindeHostedDomain(appConfig.kinde.domain),
      on_redirect_callback: (_user, appState = {}) => {
        const returnTo = typeof appState.returnTo === 'string' ? appState.returnTo : '/'
        window.history.replaceState({}, '', returnTo.startsWith('/') ? returnTo : '/')
      },
      on_error_callback: ({ error, errorDescription }) => {
        if (import.meta.env.DEV) {
          console.warn('Kinde auth redirect failed', { error, errorDescription })
        }
        window.history.replaceState({}, '', '/login')
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
