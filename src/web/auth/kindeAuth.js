import createKindeClient from '@kinde-oss/kinde-auth-pkce-js'
import { appEnv, AUTH_SCOPE } from '../config/env'

let kindeClientPromise = null
const shouldUseLocalStorageSession = (() => {
  try {
    const hostname = new URL(appEnv.kinde.domain).hostname
    return hostname.endsWith('.kinde.com')
  } catch {
    return false
  }
})()

const ensureClient = async () => {
  if (!appEnv.authEnabled) {
    return null
  }

  if (!appEnv.kindeRequiredSatisfied) {
    throw new Error(`Missing Kinde config: ${appEnv.missingKindeConfig.join(', ')}`)
  }

  if (!kindeClientPromise) {
    kindeClientPromise = createKindeClient({
      domain: appEnv.kinde.domain,
      client_id: appEnv.kinde.clientId,
      redirect_uri: appEnv.kinde.redirectUri,
      logout_uri: appEnv.kinde.logoutUri,
      scope: AUTH_SCOPE,
      is_dangerously_use_local_storage: shouldUseLocalStorageSession,
    }).catch((error) => {
      kindeClientPromise = null
      throw error
    })
  }

  return kindeClientPromise
}

export const kindeAuth = {
  async isAuthenticated() {
    const client = await ensureClient()
    if (!client) {
      return false
    }

    return client.isAuthenticated()
  },

  async login() {
    const client = await ensureClient()
    if (!client) {
      return
    }

    await client.login()
  },

  async register() {
    const client = await ensureClient()
    if (!client) {
      return
    }

    await client.register()
  },

  async logout() {
    const client = await ensureClient()
    if (!client) {
      return
    }

    await client.logout()
  },

  async getUser() {
    const client = await ensureClient()
    if (!client) {
      return null
    }

    return client.getUser()
  },

  async getGoogleAccessToken(options = {}) {
    const client = await ensureClient()
    if (!client) {
      return null
    }

    const token = await client.getToken({ isForceRefresh: Boolean(options.forceRefresh) })
    return token || null
  },
}
